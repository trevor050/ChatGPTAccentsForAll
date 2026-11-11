import { expect, it } from "vitest";
import { unpackedExtensionId } from "../scripts/extension-id.mjs";

it("matches the unpacked extension ID observed in Windows Chromium and Edge", () => {
  expect(unpackedExtensionId("C:\\Users\\Trevor\\portfolio-test\\accents\\repo\\dist\\chrome", "win32"))
    .toBe("jifjnkiiilhnifimhhhdoblpbempgpfk");
});
it("retains POSIX IDs when the same characters use UTF-8", () => {
  expect(unpackedExtensionId("C:\\Users\\Trevor\\portfolio-test\\accents\\repo\\dist\\chrome", "darwin"))
    .toBe("cfohdfihjjocmddnaadbcjdhbkoapodf");
});
