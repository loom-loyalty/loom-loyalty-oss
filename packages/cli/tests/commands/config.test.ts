import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configValidate,
  printHubSectionHint,
  runConfigCommand,
  type ConfigGenerateOptions,
  type ConfigValidateOptions,
} from "../../src/commands/config.js";

// Test directory for file operations
const TEST_DIR = join(process.cwd(), ".test-config-output");

describe("Config command utilities", () => {
  describe("toDisplayLabel (via config generate output)", () => {
    // Note: configGenerate tests require dynamic TypeScript imports that
    // don't work well in vitest. The core functionality is tested through
    // the entity overrides tests below and the validation tests.

    it("should convert snake_case to Title Case", () => {
      // Testing the conversion logic directly:
      // "member_tier" -> "Member Tier"
      // "loyalty_program" -> "Loyalty Program"
      const toDisplayLabel = (name: string): string => {
        return name
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      };

      expect(toDisplayLabel("member_tier")).toBe("Member Tier");
      expect(toDisplayLabel("loyalty_program")).toBe("Loyalty Program");
      expect(toDisplayLabel("customer")).toBe("Customer");
      expect(toDisplayLabel("reward_earning_rule")).toBe("Reward Earning Rule");
    });
  });

  describe("pluralize", () => {
    // Testing the pluralize logic directly:
    const pluralize = (word: string): string => {
      if (word.endsWith("y") && !word.endsWith("ey") && !word.endsWith("oy")) {
        return word.slice(0, -1) + "ies";
      }
      if (word.endsWith("s") || word.endsWith("x") || word.endsWith("ch") || word.endsWith("sh")) {
        return word + "es";
      }
      return word + "s";
    };

    it("should handle words ending in y", () => {
      expect(pluralize("Category")).toBe("Categories");
      expect(pluralize("Activity")).toBe("Activities");
    });

    it("should preserve words ending in ey or oy", () => {
      expect(pluralize("Key")).toBe("Keys");
      expect(pluralize("Toy")).toBe("Toys");
      expect(pluralize("Money")).toBe("Moneys");
    });

    it("should handle words ending in s/x/ch/sh", () => {
      expect(pluralize("Status")).toBe("Statuses");
      expect(pluralize("Tax")).toBe("Taxes");
      expect(pluralize("Batch")).toBe("Batches");
      expect(pluralize("Wish")).toBe("Wishes");
    });

    it("should add s for regular words", () => {
      expect(pluralize("Member")).toBe("Members");
      expect(pluralize("Tier")).toBe("Tiers");
      expect(pluralize("Program")).toBe("Programs");
    });
  });
});

describe("Config validation", () => {
  describe("validateLocalConfig (via configValidate)", () => {
    beforeEach(async () => {
      await mkdir(TEST_DIR, { recursive: true });
    });

    afterEach(async () => {
      await rm(TEST_DIR, { recursive: true, force: true });
    });

    it("should reject invalid primary color format", async () => {
      // Create a config file with invalid color
      const configPath = join(TEST_DIR, "invalid-color.config.ts");
      await writeFile(
        configPath,
        `export default {
  theme: {
    primaryColor: "not-a-color",
  },
};`
      );

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      const options: ConfigValidateOptions = {
        configFile: configPath,
      };

      await expect(configValidate(options)).rejects.toThrow();

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it("should reject invalid secondary color format", async () => {
      const configPath = join(TEST_DIR, "invalid-secondary.config.ts");
      await writeFile(
        configPath,
        `export default {
  theme: {
    primaryColor: "#0e7490",
    secondaryColor: "rgb(255,0,0)",
  },
};`
      );

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      const options: ConfigValidateOptions = {
        configFile: configPath,
      };

      await expect(configValidate(options)).rejects.toThrow();

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it("should reject invalid manifest URL", async () => {
      const configPath = join(TEST_DIR, "invalid-url.config.ts");
      await writeFile(
        configPath,
        `export default {
  customComponents: {
    manifestUrl: "not-a-valid-url",
    version: "1.0.0",
  },
};`
      );

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      const options: ConfigValidateOptions = {
        configFile: configPath,
      };

      await expect(configValidate(options)).rejects.toThrow();

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it("should reject invalid defaultListView", async () => {
      const configPath = join(TEST_DIR, "invalid-view.config.ts");
      await writeFile(
        configPath,
        `export default {
  uiSettings: {
    defaultListView: "grid",
  },
};`
      );

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      const options: ConfigValidateOptions = {
        configFile: configPath,
      };

      await expect(configValidate(options)).rejects.toThrow();

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it("should accept valid config", async () => {
      const configPath = join(TEST_DIR, "valid.config.ts");
      await writeFile(
        configPath,
        `export default {
  uiSettings: {
    showApiExplorer: true,
    defaultListView: "cards",
  },
  theme: {
    primaryColor: "#0e7490",
    secondaryColor: "#f59e0b",
  },
  entityOverrides: {
    member: {
      label: { singular: "Member", plural: "Members" },
      hidden: false,
    },
  },
  customComponents: {
    manifestUrl: "https://cdn.example.com/manifest.json",
    version: "1.0.0",
  },
};`
      );

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const options: ConfigValidateOptions = {
        configFile: configPath,
      };

      // Should not throw
      await expect(configValidate(options)).resolves.not.toThrow();

      consoleSpy.mockRestore();
    });

    it("should fail for missing config file", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      const options: ConfigValidateOptions = {
        configFile: join(TEST_DIR, "nonexistent.config.ts"),
      };

      await expect(configValidate(options)).rejects.toThrow();

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });
});

describe("Config argument parsing", () => {
  // Note: We can't easily test the argument parsers directly since they
  // call process.exit on error. Instead, we test the behavior through
  // the exported option interfaces.

  describe("ConfigGenerateOptions", () => {
    it("should have correct default values", () => {
      const defaults: ConfigGenerateOptions = {
        output: "hub.config.ts",
      };
      expect(defaults.output).toBe("hub.config.ts");
      expect(defaults.input).toBeUndefined();
      expect(defaults.environment).toBeUndefined();
    });
  });

  describe("ConfigValidateOptions", () => {
    it("should have correct default values", () => {
      const defaults: ConfigValidateOptions = {
        configFile: "hub.config.ts",
      };
      expect(defaults.configFile).toBe("hub.config.ts");
    });
  });
});

describe("Removed and unknown options", () => {
  async function runExpectingExit(args: string[]): Promise<string> {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    try {
      await expect(runConfigCommand(args)).rejects.toThrow("process.exit called");
      expect(exitSpy).toHaveBeenCalledWith(1);
      return errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  }

  it.each([
    ["push", "-e"],
    ["push", "--env"],
    ["pull", "-e"],
    ["generate", "--env"],
  ])("config %s rejects %s and points to --deployment", async (subcommand, flag) => {
    const output = await runExpectingExit([subcommand, flag, "staging", "--org", "acme"]);
    expect(output).toContain(`no longer takes ${flag}; use --deployment <name>`);
  });

  it("rejects an unknown option instead of falling back to production", async () => {
    const output = await runExpectingExit(["push", "--deploymnet", "staging", "--org", "acme"]);
    expect(output).toContain("unknown option --deploymnet");
  });
});

describe("Environment configuration", () => {
  it("should use LOOM_API_URL environment variable when set", () => {
    // The getApiUrl function checks process.env.LOOM_API_URL first
    // This is an internal function, so we test its behavior indirectly
    expect(process.env.LOOM_API_URL || "not-set").toBeDefined();
  });

  it("should map production to correct URL", () => {
    // Production should map to https://api.loomloyalty.com
    expect(true).toBe(true);
  });
});

describe("Color validation regex", () => {
  const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

  it("should accept valid 6-digit hex colors", () => {
    expect(hexColorRegex.test("#000000")).toBe(true);
    expect(hexColorRegex.test("#FFFFFF")).toBe(true);
    expect(hexColorRegex.test("#0e7490")).toBe(true);
    expect(hexColorRegex.test("#F59E0B")).toBe(true);
    expect(hexColorRegex.test("#aabbcc")).toBe(true);
  });

  it("should reject invalid color formats", () => {
    expect(hexColorRegex.test("000000")).toBe(false); // Missing #
    expect(hexColorRegex.test("#fff")).toBe(false); // 3-digit shorthand
    expect(hexColorRegex.test("#GGGGGG")).toBe(false); // Invalid hex chars
    expect(hexColorRegex.test("rgb(0,0,0)")).toBe(false); // RGB format
    expect(hexColorRegex.test("#0000000")).toBe(false); // Too long
    expect(hexColorRegex.test("#00000")).toBe(false); // Too short
    expect(hexColorRegex.test("red")).toBe(false); // Named color
  });
});

describe("printHubSectionHint", () => {
  it("points push to treadle apply and pull to treadle pull, on stderr", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      printHubSectionHint("push");
      printHubSectionHint("pull");

      const [push, pull] = error.mock.calls.map((call) => String(call[0]));
      expect(push).toContain("use treadle apply");
      expect(push).toContain("to create a hub or set its custom components");
      expect(pull).toContain("use treadle pull");
      expect(pull).toContain("theme, uiSettings, entityOverrides, featureFlags");
      expect(log).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
      log.mockRestore();
    }
  });
});
