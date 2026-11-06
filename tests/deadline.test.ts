import { test, expect } from "bun:test";
import { deadline } from "../scripts/deadline";
test("host deadline ends a stuck browser command", async () => {
  await expect(deadline(new Promise(() => {}), 10)).rejects.toThrow(
    "Host deadline exceeded",
  );
});
test("host deadline preserves successful and rejected browser commands", async () => {
  expect(await deadline(Promise.resolve("done"), 100)).toBe("done");
  await expect(
    deadline(Promise.reject(new Error("renderer crashed")), 100),
  ).rejects.toThrow("renderer crashed");
});
