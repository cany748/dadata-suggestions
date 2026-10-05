import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("FixData", function () {
  let input, instance, server;
  beforeEach(function () {
    Suggestions.resetTokens();

    server = helpers.createServer();

    input = document.createElement("input");
    document.body.append(input);
    instance = new Suggestions(input, {
      type: "ADDRESS",
    });

    helpers.returnGoodStatus(server);
  });

  afterEach(function () {
    instance.dispose();
    input.remove();
    server.restore();
  });

  it("should not clear value on fixData", async () => {
    const value = "Санкт-Петербург, ул. Софийская, д.35, корп.4, кв.81";
    input.value = value;
    let fixed = false;
    input.addEventListener("suggestions-fixdata", () => {
      fixed = true;
    });

    instance.fixData();
    server.respond(helpers.responseFor([]));

    await expect.poll(() => fixed).toBe(true);
    expect(input.value).toEqual(value);
  });
});

describe("FixData without value", () => {
  let input, instance, server;
  const serviceUrl = "/some/url";

  const suggestRequests = () => server.requests.filter((request) => /\/(?:suggest|findById)\//.test(request.url));
  const create = (options) => {
    instance = new Suggestions(input, { serviceUrl, type: "country", geoLocation: false, ...options });
    helpers.returnGoodStatus(server);
  };

  beforeEach(() => {
    Suggestions.resetTokens();
    server = helpers.createServer();
    input = document.createElement("input");
    document.body.append(input);
  });

  afterEach(() => {
    instance?.dispose();
    input.remove();
    server.restore();
  });

  it("Should trigger `suggestions-fixdata` without request when input is empty", async () => {
    const onFixData = vi.fn();
    create({});
    input.addEventListener("suggestions-fixdata", onFixData);
    input.value = "";

    instance.fixData();

    await expect.poll(() => onFixData.mock.calls.length).toBe(1);
    expect(onFixData.mock.calls[0][0].detail).toBeNull();
    expect(suggestRequests()).toHaveLength(0);
  });
});
