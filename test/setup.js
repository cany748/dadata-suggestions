import { expect, vi } from "vitest";

// Jasmine совместимость - spyOn
window.spyOn = function (obj, method) {
  const spy = vi.spyOn(obj, method);
  // Добавляем Jasmine-совместимый API
  spy.calls = {
    count() {
      return spy.mock.calls.length;
    },
    all() {
      return spy.mock.calls.map((args, index) => ({
        args,
        returnValue: spy.mock.results[index]?.value,
      }));
    },
    argsFor(index) {
      return spy.mock.calls[index];
    },
    mostRecent() {
      const calls = spy.mock.calls;
      if (calls.length === 0) return;
      return {
        args: calls.at(-1),
        returnValue: spy.mock.results.at(-1)?.value,
      };
    },
    reset() {
      spy.mockClear();
    },
  };
  return spy;
};

// Jasmine совместимость - jasmine.clock()
window.jasmine = {
  clock() {
    return {
      install() {
        vi.useFakeTimers();
      },
      uninstall() {
        vi.useRealTimers();
      },
      tick(ms) {
        vi.advanceTimersByTime(ms);
      },
      mockDate(date) {
        vi.setSystemTime(date);
      },
    };
  },
  // Jasmine матчеры для expect
  objectContaining(obj) {
    return expect.objectContaining(obj);
  },
  any(constructor) {
    return expect.any(constructor);
  },
  anything() {
    return expect.anything();
  },
  arrayContaining(array) {
    return expect.arrayContaining(array);
  },
  stringMatching(str) {
    return expect.stringMatching(str);
  },
};

expect.extend({
  toContainText(received, expected) {
    const text = received.textContent;
    const pass = text.includes(expected);

    return {
      pass,
      message: () =>
        pass
          ? `Expected element not to contain text "${expected}", but it did`
          : `Expected element to contain text "${expected}", but got "${text}"`,
    };
  },
});
