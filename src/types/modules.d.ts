// Ambient type declarations for modules loaded via import map

declare module 'react' {
  export * from '@types/react';
  export { default } from '@types/react';
}

declare module 'react-dom/client' {
  export * from '@types/react-dom/client';
}

declare module 'react-router-dom' {
  export * from '@types/react-router-dom';
}

declare module '@google/genai' {
  export class GoogleGenAI {
    constructor(config: { apiKey: string });
    models: {
      generateContent(params: {
        model: string;
        contents: string | any[];
        config?: {
          responseMimeType?: string;
          responseSchema?: any;
          temperature?: number;
          systemInstruction?: string;
        };
      }): Promise<GenerateContentResponse>;
    };
  }
  
  export interface GenerateContentResponse {
    text(): string;
    response: {
      text(): string;
    };
  }
  
  export const Type: {
    ARRAY: string;
    OBJECT: string;
    STRING: string;
    NUMBER: string;
    INTEGER: string;
  };
}

declare module '@google/generative-ai' {
  export * from '@google/genai';
}

declare module 'recharts' {
  import { ComponentType } from 'react';
  
  export const PieChart: ComponentType<any>;
  export const Pie: ComponentType<any>;
  export const Cell: ComponentType<any>;
  export const Tooltip: ComponentType<any>;
  export const ResponsiveContainer: ComponentType<any>;
  export const AreaChart: ComponentType<any>;
  export const Area: ComponentType<any>;
  export const CartesianGrid: ComponentType<any>;
  export const XAxis: ComponentType<any>;
  export const YAxis: ComponentType<any>;
  export const Legend: ComponentType<any>;
}

declare module 'firebase/app' {
  export function initializeApp(config: any): any;
}

declare module 'firebase/firestore' {
  export function getFirestore(app?: any): any;
  export function connectFirestoreEmulator(firestore: any, host: string, port: number): void;
  export function collection(firestore: any, path: string): any;
  export function doc(firestore: any, path: string, ...pathSegments: string[]): any;
  export function getDoc(docRef: any): Promise<any>;
  export function getDocs(query: any): Promise<any>;
  export function setDoc(docRef: any, data: any, options?: any): Promise<void>;
  export function addDoc(collectionRef: any, data: any): Promise<any>;
  export function query(collectionRef: any, ...queryConstraints: any[]): any;
  export function orderBy(fieldPath: string, directionStr?: 'asc' | 'desc'): any;
  export function limit(limit: number): any;
  export function where(fieldPath: string, opStr: any, value: any): any;
  export function serverTimestamp(): any;
  export function onSnapshot(reference: any, callback: (snapshot: any) => void): () => void;
}

declare module 'firebase/auth' {
  export function getAuth(app?: any): any;
  export function connectAuthEmulator(auth: any, url: string): void;
  export function createUserWithEmailAndPassword(auth: any, email: string, password: string): Promise<any>;
  export function signInWithEmailAndPassword(auth: any, email: string, password: string): Promise<any>;
  export function signOut(auth: any): Promise<void>;
  export function onAuthStateChanged(auth: any, callback: (user: any) => void): () => void;
  export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    getIdTokenResult(): Promise<any>;
  }
}

declare module 'firebase/functions' {
  export function getFunctions(app?: any): any;
  export function connectFunctionsEmulator(functions: any, host: string, port: number): void;
  export function httpsCallable(functions: any, name: string): (data?: any) => Promise<any>;
}