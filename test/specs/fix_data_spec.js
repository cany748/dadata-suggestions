import { fakeServer } from "nise";
import helpers from "../helpers";
import { Suggestions } from "@/suggestions";

describe("FixData", function () {
  beforeEach(function () {
    Suggestions.resetTokens();

    this.server = fakeServer.create();

    this.input = document.createElement("input");
    document.body.append(this.input);
    this.instance = new Suggestions(this.input, {
      type: "ADDRESS",
    });

    helpers.returnGoodStatus(this.server);
  });

  afterEach(function () {
    this.instance.dispose();
    this.input.remove();
    this.server.restore();
  });

  it("should not clear value on fixData", function () {
    const value = "Санкт-Петербург, ул. Софийская, д.35, корп.4, кв.81";
    this.input.value = value;

    this.instance.fixData();
    this.server.respond(helpers.responseFor([]));

    expect(this.input.value).toEqual(value);
  });
});
