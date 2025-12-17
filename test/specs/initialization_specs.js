import { fakeServer } from "nise";
import helpers from "../helpers";
import { DEFAULT_OPTIONS } from "@/suggestions";

describe.only("Initialization", function () {
  const serviceUrl = "/some/url";
  const $body = $(document.body);

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
      $.each(["$wrapper", "$container"], function (i, component) {
        expect(instance[component].length).toEqual(1);
      });
    });
  }

  beforeEach(function () {
    $.Suggestions.resetTokens();

    this.server = fakeServer.create();
  });

  afterEach(function () {
    this.server.restore();
  });

  describe("visible element", function () {
    beforeEach(function () {
      this.input = document.createElement("input");
      this.$input = $(this.input).appendTo($body);
      this.instance = this.$input
        .suggestions({
          serviceUrl,
          type: "NAME",
        })
        .suggestions();

      helpers.returnGoodStatus(this.server);
    });

    afterEach(function () {
      this.instance.dispose();
      this.$input.remove();
    });

    it("Should initialize suggestions options", function () {
      expect(this.instance.options.serviceUrl).toEqual(serviceUrl);
    });

    checkInitialized();
  });

  describe("check defaults", function () {
    beforeEach(function () {
      this.input = document.createElement("input");
      this.$input = $(this.input).appendTo($body);
      this.instance = this.$input
        .suggestions({
          type: "NAME",
        })
        .suggestions();

      helpers.returnGoodStatus(this.server);
    });

    afterEach(function () {
      this.instance.dispose();
      this.$input.remove();
    });

    it("serviceUrl", function () {
      expect(this.instance.options.serviceUrl).toEqual(DEFAULT_OPTIONS.serviceUrl);
    });

    checkInitialized();
  });

  describe("check custom options", function () {
    beforeEach(function () {
      this.input = document.createElement("input");
      this.$input = $(this.input).appendTo($body);
      this.instance = this.$input
        .suggestions({
          type: "NAME",
          serviceUrl: "http://domain.com",
        })
        .suggestions();

      helpers.returnGoodStatus(this.server);
    });

    afterEach(function () {
      this.instance.dispose();
      this.$input.remove();
    });

    it("serviceUrl", function () {
      expect(this.instance.options.serviceUrl).toEqual("http://domain.com");
    });

    checkInitialized();
  });
});
