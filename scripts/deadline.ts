export async function deadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Host deadline exceeded")),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
