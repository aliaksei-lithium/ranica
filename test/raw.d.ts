// Vite `?raw` imports: fixture files as strings (the tests have no Node types).
declare module '*?raw' {
  const text: string;
  export default text;
}
