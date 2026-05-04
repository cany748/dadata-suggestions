import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("FixData", function () {
  let input, instance, server;
  beforeEach(function () {
    Suggestions.resetTokens();

    server = fakeServer.create();

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

  it("should not clear value on fixData", function () {
    const value = "Санкт-Петербург, ул. Софийская, д.35, корп.4, кв.81";
    input.value = value;

    instance.fixData();
    server.respond(helpers.responseFor([]));

    expect(input.value).toEqual(value);
  });
});
