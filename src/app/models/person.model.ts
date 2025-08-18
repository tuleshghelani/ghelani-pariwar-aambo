export interface Person {
  id: string;
  name: string;
  children?: Person[];
}