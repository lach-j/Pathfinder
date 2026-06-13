export class PathfinderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathfinderError";
  }
}
