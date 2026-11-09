export function getSaved(key: string): string | null {
  try {
    return localStorage.getItem(`rill:v1:${key}`);
  } catch {
    return null;
  }
}
export function save(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(`rill:v1:${key}`);
    else localStorage.setItem(`rill:v1:${key}`, value);
    return true;
  } catch {
    return false;
  }
}
