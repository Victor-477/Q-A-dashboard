export interface Question {
  id: string;
  topicNumber: number;
  studentName: string;
  text: string;
  answer?: string;
  answeredBy?: string;
  createdAt: string;
  answeredAt?: string;
}
