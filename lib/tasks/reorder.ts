export function calculateNewPosition(prevPosition: number | null, nextPosition: number | null): number {
  if (prevPosition === null && nextPosition === null) return 0;
  if (prevPosition === null) return nextPosition! - 10;
  if (nextPosition === null) return prevPosition + 10;
  return (prevPosition + nextPosition) / 2;
}
