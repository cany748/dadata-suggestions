import { expect, vi } from "vitest";
import $ from "cash-dom";
import "../src/main";

// Глобальные переменные для браузера
window.$ = $;

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

// Создаём поддержку для `this` контекста в beforeEach/afterEach/it
let currentTestContext = null;

// Переопределяем глобальные beforeEach и afterEach для поддержки this
const originalBeforeEach = window.beforeEach;
const originalAfterEach = window.afterEach;

window.beforeEach = function (fn) {
  originalBeforeEach(() => {
    // Создаём новый контекст только для первого beforeEach в цепочке
    if (currentTestContext === null) {
      currentTestContext = {};
    }
    return fn.call(currentTestContext);
  });
};

window.afterEach = function (fn) {
  originalAfterEach(() => {
    const context = currentTestContext;
    return fn.call(context);
  });
};

// Добавляем внутренний afterEach который сбросит контекст в самом конце
originalAfterEach(() => {
  // Этот hook выполнится последним, сбросим контекст
  currentTestContext = null;
});

// Переопределяем it для передачи контекста
const originalIt = window.it;
window.it = function (name, fn) {
  if (typeof fn === "function") {
    return originalIt(name, function () {
      // Убедимся, что контекст существует перед выполнением теста
      if (currentTestContext === null) {
        currentTestContext = {};
      }
      return fn.call(currentTestContext);
    });
  }
  return originalIt(name, fn);
};

expect.extend({
  toContainText(received, expected) {
    const element = received instanceof $ ? received : $(received);
    const text = element.text();
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
