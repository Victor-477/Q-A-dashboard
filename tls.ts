import fs from "fs";
import path from "path";
import selfsigned from "selfsigned";
import { X509Certificate } from "crypto";
import { networkInterfaces } from "os";

/**
 * Self-signed TLS material for the classroom server.
 *
 * The teacher's password is posted to /api/teacher/login, so over plain HTTP it
 * crosses the local network in cleartext and anyone sniffing the Wi-Fi can read
 * it. A self-signed certificate fixes that: the traffic is encrypted, at the
 * cost of a one-time browser warning on each device, because no public CA
 * vouches for the certificate.
 *
 * The certificate is generated once and reused, so a device that accepted it
 * keeps working across restarts. It is regenerated only when it has expired or
 * the machine's LAN addresses changed.
 */

export interface TlsMaterial {
  key: string;
  cert: string;
  /** Names and addresses the certificate is valid for. */
  hosts: string[];
  /** True when this run had to create a new certificate. */
  generated: boolean;
  certPath: string;
}

const CERT_FILE = "qa-board-cert.pem";
const KEY_FILE = "qa-board-key.pem";
const VALID_DAYS = 825; // Browsers reject self-signed certs valid for much longer.

/** IPv4 addresses this machine can be reached at on the LAN. */
export function getLanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((details): details is NonNullable<typeof details> => Boolean(details))
    .filter(details => details.family === "IPv4" && !details.internal)
    .map(details => details.address);
}

/**
 * Every name the certificate should cover. Including the LAN IPs matters:
 * without a matching SAN, browsers reject the certificate outright instead of
 * offering the "proceed anyway" escape hatch.
 */
function certificateHosts() {
  const hosts = new Set<string>(["localhost", "127.0.0.1", "::1"]);
  for (const address of getLanAddresses()) {
    hosts.add(address);
  }
  return [...hosts];
}

function isIpv4(value: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value);
}

/** Reads an existing certificate if it is still usable for these hosts. */
function loadExisting(dir: string, hosts: string[]): TlsMaterial | null {
  const certPath = path.join(dir, CERT_FILE);
  const keyPath = path.join(dir, KEY_FILE);

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    return null;
  }

  try {
    const cert = fs.readFileSync(certPath, "utf8");
    const key = fs.readFileSync(keyPath, "utf8");

    // X509Certificate lets us check expiry and coverage without re-parsing by hand.
    const parsed = new X509Certificate(cert);

    if (Date.parse(parsed.validTo) <= Date.now()) {
      return null;
    }

    // If the machine moved to a different network, the old SANs no longer
    // cover it and students would get a hard rejection.
    //
    // Only the IPv4 addresses and DNS names are checked. The loopback entries
    // never change, and comparing them textually is a trap: OpenSSL writes ::1
    // back as "0:0:0:0:0:0:0:1", so a naive check never matches and the
    // certificate would be regenerated on every start — handing every device a
    // fresh warning each time.
    const subjectAltName = parsed.subjectAltName ?? "";
    const mustCover = hosts.filter(host => host !== "::1");
    const covered = mustCover.every(host => subjectAltName.includes(host));
    if (!covered) {
      return null;
    }

    return { key, cert, hosts, generated: false, certPath };
  } catch {
    // Unreadable or malformed material: fall through and regenerate.
    return null;
  }
}

/**
 * Returns TLS material for the given data directory, creating it on first run.
 */
export function ensureCertificate(dataDir: string): TlsMaterial {
  fs.mkdirSync(dataDir, { recursive: true });
  const hosts = certificateHosts();

  const existing = loadExisting(dataDir, hosts);
  if (existing) {
    return existing;
  }

  const attrs = [{ name: "commonName", value: "localhost" }];
  const pems = selfsigned.generate(attrs, {
    days: VALID_DAYS,
    keySize: 2048,
    algorithm: "sha256",
    extensions: [
      { name: "basicConstraints", cA: false },
      {
        name: "keyUsage",
        digitalSignature: true,
        keyEncipherment: true
      },
      { name: "extKeyUsage", serverAuth: true },
      {
        name: "subjectAltName",
        altNames: hosts.map(host =>
          // type 7 = IP address, type 2 = DNS name
          isIpv4(host) || host === "::1" ? { type: 7, ip: host } : { type: 2, value: host }
        )
      }
    ]
  });

  const certPath = path.join(dataDir, CERT_FILE);
  const keyPath = path.join(dataDir, KEY_FILE);

  fs.writeFileSync(certPath, pems.cert, { mode: 0o600 });
  fs.writeFileSync(keyPath, pems.private, { mode: 0o600 });

  return { key: pems.private, cert: pems.cert, hosts, generated: true, certPath };
}

/** Whether TLS should be used at all. Defaults to on; QA_TLS=off disables it. */
export function isTlsEnabled() {
  const value = (process.env.QA_TLS ?? "auto").trim().toLowerCase();
  return value !== "off" && value !== "false" && value !== "0";
}
