import {
  test,
  expect,
  Page,
  Locator,
  BrowserContext,
  Browser,
} from "@playwright/test";
import {
  assertChildrenOrderIDs,
  getDraggedRect,
  initialize,
  invokeKeyboardAndAssertEmittedMsg,
  moveDragged,
} from "../../utils";

test.describe.serial("Dragging from bottom up", async () => {
  let page: Page;
  let context: BrowserContext;
  let activeBrowser: Browser;

  const draggedID = "#id-12";

  let elm10: Locator;
  let elm09: Locator;
  let elm11: Locator;
  let elm12: Locator;
  let parentLocater: Locator;

  const FINAL_IDS = ["id-12", "id-9", "id-10", "id-11"];

  test.beforeAll(async ({ browser, browserName, baseURL }) => {
    activeBrowser = browser;

    context = await activeBrowser.newContext();
    page = await context.newPage();
    initialize(page, browserName);
    await page.goto(baseURL!);

    [parentLocater, elm09, elm10, elm11, elm12] = await Promise.all([
      page.locator("#id-p3"),
      page.locator("#id-9"),
      page.locator("#id-10"),
      page.locator("#id-11"),
      page.locator("#id-12"),
    ]);
  });

  test.afterAll(async () => {
    await page.close();
    await context.close();
    // await activeBrowser.close();
  });

  test("Moving dragged element outside its position", async () => {
    await getDraggedRect(elm12);
    await moveDragged(-35, -35);
  });

  test("Checking the stability of the new positions", async () => {
    await Promise.all([
      expect(elm09).toHaveCSS("transform", "none"),
      expect(elm10).toHaveCSS("transform", "none"),
      expect(elm11).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 58)"),
    ]);
  });

  test("Continue transformation to the top below #9", async () => {
    await moveDragged(-90, -90);
  });

  test("Transform elm#10 and elm#11 once it's entering the threshold", async () => {
    await Promise.all([
      expect(elm09).toHaveCSS("transform", "none"),
      expect(elm10).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 58)"),
      expect(elm11).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 58)"),
    ]);
  });

  test("Continue transformation to the top outside the container", async () => {
    await moveDragged(-190, -190);
  });

  test("Transform elm#10 and elm#11 back to their positions", async () => {
    await Promise.all([
      expect(elm09).toHaveCSS("transform", "none"),
      expect(elm10).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)"),
      expect(elm11).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)"),
    ]);
  });

  test("Insert dragged into elm#9 breaking point", async () => {
    await moveDragged(0, -190);
  });

  test("Triggers mouseup", async () => {
    await page.dispatchEvent(draggedID, "mouseup", {
      button: 0,
      force: true,
    });
  });

  test("Siblings positioned correctly", async () => {
    await Promise.all([
      expect(elm09).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 58)"),
      expect(elm10).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 58)"),
      expect(elm11).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 58)"),
      expect(elm12).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -174)"),
    ]);
  });

  test("Trigger key `c` to commit the transformed elements and read the emitted message for mutation", async () => {
    await invokeKeyboardAndAssertEmittedMsg(FINAL_IDS);
  });

  test("Siblings that have reconciled don't have transformation", async () => {
    await Promise.all([
      expect(elm09).toHaveCSS("transform", "none"),
      expect(elm10).toHaveCSS("transform", "none"),
      expect(elm11).toHaveCSS("transform", "none"),
      expect(elm12).toHaveCSS("transform", "none"),
    ]);
  });

  test("Siblings have the correct order", async () => {
    await assertChildrenOrderIDs(parentLocater, FINAL_IDS);
  });
});
