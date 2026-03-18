import { fakeServer } from "nise";
import helpers from "../helpers";
import { DEFAULT_OPTIONS, Suggestions } from "@/suggestions";

describe.only("Initialization", function () {
  const serviceUrl = "/some/url";

  /**
   * Just a wrapper for a bunch of specs to check that instance is completely initialized
   * Wherever called, runs these specs in current environment
   */
  function checkInitialized() {
    it("Should request service status", function () {
      expect(this.server.requests.length).toBe(1);
      expect(this.server.requests[0].url).toContain("/status/fio");
    });

    it("Should create all additional components", function () {
      const instance = this.instance;
      expect(instance.wrapper).toBeInstanceOf(HTMLElement);
      expect(instance.container).toBeInstanceOf(HTMLElement);
    });
  }

  beforeEach(function () {
    Suggestions.resetTokens();

    this.server = fakeServer.create();
  });

  afterEach(function () {
    this.server.restore();
  });

  describe("visible element", function () {
    beforeEach(function () {
      this.input = document.createElement("input");
      document.body.append(this.input);
      this.instance = new Suggestions(this.input, {
        serviceUrl,
        type: "NAME",
      });

      helpers.returnGoodStatus(this.server);
    });

    afterEach(function () {
      this.instance.dispose();
      this.input.remove();
    });

    it("Should initialize suggestions options", function () {
      expect(this.instance.options.serviceUrl).toEqual(serviceUrl);
    });

    checkInitialized();
  });

  describe("check defaults", function () {
    beforeEach(function () {
      this.input = document.createElement("input");
      document.body.append(this.input);
      this.instance = new Suggestions(this.input, {
        type: "NAME",
      });

      helpers.returnGoodStatus(this.server);
    });

    afterEach(function () {
      this.instance.dispose();
      this.input.remove();
    });

    it("serviceUrl", function () {
      expect(this.instance.options.serviceUrl).toEqual(DEFAULT_OPTIONS.serviceUrl);
    });

    checkInitialized();
  });

  describe("check custom options", function () {
    beforeEach(function () {
      this.input = document.createElement("input");
      document.body.append(this.input);
      this.instance = new Suggestions(this.input, {
        type: "NAME",
        serviceUrl: "http://domain.com",
      });

      helpers.returnGoodStatus(this.server);
    });

    afterEach(function () {
      this.instance.dispose();
      this.input.remove();
    });

    it("serviceUrl", function () {
      expect(this.instance.options.serviceUrl).toEqual("http://domain.com");
    });

    checkInitialized();
  });
});
