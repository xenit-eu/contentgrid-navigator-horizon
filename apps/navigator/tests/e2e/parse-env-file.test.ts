import { describe, expect, it } from "vitest";
import { parseEnvContent } from "./parse-env-file";

describe("parseEnvContent", () => {
  it("parses a simple key=value pair", () => {
    expect(parseEnvContent("KEY=value")).toEqual({ KEY: "value" });
  });

  it("parses multiple lines", () => {
    expect(parseEnvContent("A=1\nB=2")).toEqual({ A: "1", B: "2" });
  });

  it("strips surrounding double quotes from values", () => {
    expect(parseEnvContent('KEY="hello world"')).toEqual({ KEY: "hello world" });
  });

  it("strips surrounding single quotes from values", () => {
    expect(parseEnvContent("KEY='hello world'")).toEqual({ KEY: "hello world" });
  });

  it("does not strip mismatched quotes", () => {
    expect(parseEnvContent("KEY=\"hello'")).toEqual({ KEY: "\"hello'" });
  });

  it("does not strip quotes that are only on one side", () => {
    expect(parseEnvContent('KEY="hello')).toEqual({ KEY: '"hello' });
  });

  it("preserves = signs inside the value", () => {
    expect(parseEnvContent("KEY=a=b=c")).toEqual({ KEY: "a=b=c" });
  });

  it("trims trailing whitespace from keys", () => {
    expect(parseEnvContent("KEY  =value")).toEqual({ KEY: "value" });
  });

  it("trims whitespace from values before quote-stripping", () => {
    expect(parseEnvContent('KEY=  "value"  ')).toEqual({ KEY: "value" });
  });

  it("ignores comment lines", () => {
    expect(parseEnvContent("# this is a comment\nKEY=value")).toEqual({ KEY: "value" });
  });

  it("ignores blank lines", () => {
    expect(parseEnvContent("\nKEY=value\n")).toEqual({ KEY: "value" });
  });

  it("ignores whitespace-only lines", () => {
    expect(parseEnvContent("   \nKEY=value")).toEqual({ KEY: "value" });
  });

  it("ignores lines with no = sign", () => {
    expect(parseEnvContent("NOEQUALS")).toEqual({});
  });

  it("ignores lines where the first non-whitespace is =", () => {
    expect(parseEnvContent("=value")).toEqual({});
  });

  it("handles CRLF line endings", () => {
    expect(parseEnvContent("A=1\r\nB=2")).toEqual({ A: "1", B: "2" });
  });

  it("returns empty object for empty string input", () => {
    expect(parseEnvContent("")).toEqual({});
  });

  it("returns empty string for KEY with no value", () => {
    expect(parseEnvContent("KEY=")).toEqual({ KEY: "" });
  });

  it("later duplicate key wins", () => {
    expect(parseEnvContent("KEY=first\nKEY=second")).toEqual({ KEY: "second" });
  });
});
