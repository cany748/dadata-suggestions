import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("Keyboard navigation", function () {
  let input, instance, server;
  const serviceUrl = "/some/url";
  const suggestions = [
    { value: "Afghanistan", data: "Af" },
    { value: "Albania", data: "Al" },
    { value: "Andorra", data: "An" },
  ];

  beforeEach(function () {
    Suggestions.resetTokens();

    server = fakeServer.create();

    input = document.createElement("input");
    document.body.append(input);
    instance = new Suggestions(input, {
      serviceUrl,
      type: "NAME",
    });

    helpers.returnGoodStatus(server);
  });

  afterEach(function () {
    instance.dispose();
    input.remove();
    server.restore();
  });

  it("Should select first suggestion on DOWN key in textbox", async () => {
    instance.selectedIndex = -1;

    input.value = "A";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);
    helpers.keydown(input, 40);

    expect(instance.selectedIndex).toBe(0);
    expect(input.value).toEqual(suggestions[0].value);
  });

  it("Should select last suggestion on UP key in textbox", async () => {
    instance.selectedIndex = -1;

    input.value = "A";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);
    helpers.keydown(input, 38);

    expect(instance.selectedIndex).toBe(2);
    expect(input.value).toEqual(suggestions[2].value);
  });

  it("Should select textbox on DOWN key in last suggestion", async () => {
    instance.selectedIndex = -1;

    input.value = "A";
    instance.onValueChange();
    server.respond(helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);
    instance.selectedIndex = 2;
    helpers.keydown(input, 40);

    expect(instance.selectedIndex).toBe(-1);
    expect(input.value).toEqual("A");
  });
});

describe("Keyboard", () => {
  let input, instance, server;
  const serviceUrl = "/some/url";
  const suggestions = [
    { value: "Afghanistan", data: "Af" },
    { value: "Albania", data: "Al" },
    { value: "Andorra", data: "An" },
  ];

  const keydown = (keyCode) => {
    const event = new KeyboardEvent("keydown", { keyCode, which: keyCode, bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    return event;
  };
  const type = (value) => {
    input.value = value;
    input.dispatchEvent(new Event("input"));
  };
  const suggestRequests = () => server.requests.filter((request) => request.url.includes("/suggest/"));
  const shownValues = () => Array.from(input.nextElementSibling.querySelectorAll(".suggestions-suggestion"), (el) => el.textContent);
  const activeValue = () => input.nextElementSibling.querySelector(".suggestions-selected")?.textContent;

  const showSuggestions = async (options) => {
    instance = new Suggestions(input, { serviceUrl, type: "country", deferRequestBy: 0, ...options });
    helpers.returnGoodStatus(server);
    type("A");
    suggestRequests()[0].respond(...helpers.responseFor(suggestions));
    await expect.poll(() => instance.visible).toBe(true);
  };

  beforeEach(() => {
    Suggestions.resetTokens();
    server = fakeServer.create();
    input = document.createElement("input");
    document.body.append(input);
  });

  afterEach(() => {
    instance.dispose();
    input.remove();
    server.restore();
  });

  it("ESC should restore typed value and hide dropdown", async () => {
    await showSuggestions();
    keydown(40);
    expect(input.value).toEqual("Afghanistan");

    keydown(27);

    expect(input.value).toEqual("A");
    expect(instance.visible).toBe(false);
    expect(shownValues()).toEqual([]);
  });
  it("ESC should abort pending request so that the dropdown stays closed", async () => {
    await showSuggestions();
    type("Al");
    const pending = suggestRequests()[1];

    keydown(27);

    expect(pending.aborted).toBe(true);
    expect(shownValues()).toEqual([]);
  });
  it("DOWN should reopen hidden dropdown without a new request", async () => {
    await showSuggestions();
    keydown(27);

    keydown(40);

    expect(shownValues()).toEqual(["Afghanistan", "Albania", "Andorra"]);
    expect(suggestRequests()).toHaveLength(1);
  });
  it("DOWN after selection should reopen dropdown with selected suggestion highlighted", async () => {
    await showSuggestions();
    await instance.select(1);
    expect(instance.visible).toBe(false);

    keydown(40);

    expect(shownValues()).toEqual(["Afghanistan", "Albania", "Andorra"]);
    expect(activeValue()).toEqual("Albania");
  });
  it("DOWN should not open dropdown that contains only current selection", () => {
    instance = new Suggestions(input, { serviceUrl, type: "country" });
    instance.setSuggestion({ value: "Albania", data: { code: "AL" } });

    keydown(40);

    expect(instance.visible).toBe(false);
    expect(shownValues()).toEqual([]);
  });
  it("Should scroll dropdown to keep active suggestion visible", async () => {
    await showSuggestions();
    const container = input.nextElementSibling.firstElementChild;
    container.style.overflowY = "auto";
    container.style.maxHeight = "30px";
    for (const item of container.children) item.style.height = "20px";

    keydown(40);
    keydown(40);
    keydown(40);
    expect(container.scrollTop).toBeGreaterThan(0);
    const lastItem = container.lastElementChild;
    expect(lastItem.offsetTop - container.offsetTop + lastItem.offsetHeight).toBeLessThanOrEqual(
      container.scrollTop + container.clientHeight,
    );

    keydown(38);
    keydown(38);
    expect(container.scrollTop).toBe(container.firstElementChild.nextElementSibling.offsetTop - container.offsetTop);
  });
  it("UP should move to the previous suggestion", async () => {
    await showSuggestions();
    keydown(40);
    keydown(40);

    keydown(38);

    expect(activeValue()).toEqual("Afghanistan");
    expect(input.value).toEqual("Afghanistan");
  });
  it("UP on the first suggestion should deactivate it and restore typed value", async () => {
    await showSuggestions();
    keydown(40);

    keydown(38);

    expect(activeValue()).toBeUndefined();
    expect(input.value).toEqual("A");
    expect(instance.visible).toBe(true);
  });
  it("Should prevent default action of navigation keys but not of regular keys", async () => {
    await showSuggestions();

    expect(keydown(40).defaultPrevented).toBe(true);
    expect(keydown(65).defaultPrevented).toBe(false);
  });
  it("TAB should move focus by default", async () => {
    await showSuggestions();

    expect(keydown(9).defaultPrevented).toBe(false);
  });
  it("TAB should be blocked when `tabDisabled` is set", async () => {
    await showSuggestions({ tabDisabled: true });

    expect(keydown(9).defaultPrevented).toBe(true);
  });
});
