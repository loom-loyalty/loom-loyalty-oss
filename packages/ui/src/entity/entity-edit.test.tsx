/**
 * EntityEdit Component Tests
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReadOnlyProvider } from "../shell/read-only.js";
import { EntityEdit } from "./entity-edit.js";

const mockSchema: UIEntitySchema = {
  entityCode: "member",
  singularName: "Member",
  pluralName: "Members",
  icon: "Users",
  displayField: "name",
  canCreate: true,
  canEdit: true,
  canDelete: true,
  fields: {
    id: {
      name: "id",
      label: "ID",
      widget: "text",
      displayFormat: "text",
      showInList: false,
      showInDetail: true,
      showInCreate: false,
      showInEdit: false,
    },
    name: {
      name: "name",
      label: "Name",
      helpText: "Enter the member's full name",
      widget: "text",
      displayFormat: "text",
      showInList: true,
      showInDetail: true,
      showInCreate: true,
      showInEdit: true,
    },
    email: {
      name: "email",
      label: "Email",
      helpText: "Primary contact email address",
      widget: "email",
      displayFormat: "email",
      showInList: true,
      showInDetail: true,
      showInCreate: true,
      showInEdit: true,
    },
    password: {
      name: "password",
      label: "Password",
      helpText: "At least 8 characters",
      widget: "password",
      displayFormat: "text",
      showInList: false,
      showInDetail: false,
      showInCreate: true,
      showInEdit: false,
    },
    status: {
      name: "status",
      label: "Status",
      widget: "select",
      displayFormat: "badge",
      showInList: true,
      showInDetail: true,
      showInCreate: true,
      showInEdit: true,
    },
    points: {
      name: "points",
      label: "Points",
      widget: "number",
      displayFormat: "number",
      showInList: true,
      showInDetail: true,
      showInCreate: false,
      showInEdit: true,
    },
    bio: {
      name: "bio",
      label: "Bio",
      helpText: "Tell us a little about yourself",
      placeholder: "Enter a brief bio...",
      widget: "textarea",
      displayFormat: "textarea",
      showInList: false,
      showInDetail: true,
      showInCreate: true,
      showInEdit: true,
    },
    isVip: {
      name: "isVip",
      label: "VIP Member",
      helpText: "Grant VIP status for exclusive benefits",
      widget: "switch",
      displayFormat: "boolean",
      showInList: false,
      showInDetail: true,
      showInCreate: true,
      showInEdit: true,
    },
    receiveNewsletter: {
      name: "receiveNewsletter",
      label: "Receive Newsletter",
      helpText: "Send monthly newsletter",
      widget: "checkbox",
      displayFormat: "boolean",
      showInList: false,
      showInDetail: true,
      showInCreate: true,
      showInEdit: true,
    },
  },
  list: {
    columns: ["name", "email", "status", "points"],
    defaultSort: "name",
    defaultSortDirection: "asc",
    searchable: true,
    pageSizes: [10, 25, 50],
  },
  detail: {
    groups: [
      {
        id: "basic",
        label: "Basic Information",
        fields: ["name", "email", "status"],
        order: 1,
      },
    ],
    showTimestamps: true,
  },
  create: {
    groups: [
      {
        id: "account",
        label: "Account Information",
        description: "Set up the member's account credentials",
        fields: ["name", "email", "password", "status"],
        order: 1,
      },
      {
        id: "profile",
        label: "Profile",
        description: "Optional profile information",
        fields: ["bio"],
        order: 2,
      },
      {
        id: "preferences",
        label: "Preferences",
        fields: ["isVip", "receiveNewsletter"],
        order: 3,
      },
    ],
    showCancel: true,
    showReset: true,
    submitLabel: "Create Member",
    cancelLabel: "Discard",
  },
  edit: {
    groups: [
      {
        id: "account",
        label: "Account Information",
        fields: ["name", "email", "status"],
        order: 1,
      },
      {
        id: "points",
        label: "Loyalty",
        fields: ["points"],
        order: 2,
      },
      {
        id: "profile",
        label: "Profile",
        fields: ["bio"],
        order: 3,
      },
      {
        id: "preferences",
        label: "Preferences",
        fields: ["isVip", "receiveNewsletter"],
        order: 4,
      },
    ],
    showCancel: true,
    submitLabel: "Save Changes",
  },
};

const mockExistingData = {
  id: "1",
  name: "John Doe",
  email: "john@example.com",
  status: "active",
  points: 1500,
  bio: "A long-time member and advocate.",
  isVip: true,
  receiveNewsletter: true,
};

describe("EntityEdit", () => {
  it("renders form fields in create mode", () => {
    render(<EntityEdit schema={mockSchema} mode="create" onSubmit={async () => {}} />);

    // Should show create mode fields
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders form fields in edit mode", () => {
    render(
      <EntityEdit
        schema={mockSchema}
        mode="edit"
        initialValues={mockExistingData}
        onSubmit={async () => {}}
      />
    );

    // Should show edit mode fields (password not shown in edit)
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/points/i)).toBeInTheDocument();
  });

  it("pre-fills form with initial values in edit mode", () => {
    render(
      <EntityEdit
        schema={mockSchema}
        mode="edit"
        initialValues={mockExistingData}
        onSubmit={async () => {}}
      />
    );

    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
    expect(nameInput.value).toBe("John Doe");

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    expect(emailInput.value).toBe("john@example.com");
  });

  it("renders field groups with labels", () => {
    render(<EntityEdit schema={mockSchema} mode="create" onSubmit={async () => {}} />);

    expect(screen.getByText("Account Information")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Preferences")).toBeInTheDocument();
  });

  it("renders group descriptions when provided", () => {
    render(<EntityEdit schema={mockSchema} mode="create" onSubmit={async () => {}} />);

    expect(screen.getByText("Set up the member's account credentials")).toBeInTheDocument();
    expect(screen.getByText("Optional profile information")).toBeInTheDocument();
  });

  it("shows field help text", () => {
    render(<EntityEdit schema={mockSchema} mode="create" onSubmit={async () => {}} />);

    expect(screen.getByText("Enter the member's full name")).toBeInTheDocument();
    expect(screen.getByText("Primary contact email address")).toBeInTheDocument();
  });

  it("shows submit button with correct label", () => {
    render(<EntityEdit schema={mockSchema} mode="create" onSubmit={async () => {}} />);

    expect(screen.getByRole("button", { name: /create member/i })).toBeInTheDocument();
  });

  it("shows submit button with edit label in edit mode", () => {
    render(
      <EntityEdit
        schema={mockSchema}
        mode="edit"
        initialValues={mockExistingData}
        onSubmit={async () => {}}
      />
    );

    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });

  it("shows cancel button when showCancel is true", () => {
    const onCancel = vi.fn();
    render(
      <EntityEdit schema={mockSchema} mode="create" onSubmit={async () => {}} onCancel={onCancel} />
    );

    const cancelButton = screen.getByRole("button", { name: /discard/i });
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows reset button in create mode when showReset is true", () => {
    render(<EntityEdit schema={mockSchema} mode="create" onSubmit={async () => {}} />);

    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  it("calls onSubmit with form values on submit", async () => {
    const onSubmit = vi.fn();
    render(<EntityEdit schema={mockSchema} mode="create" onSubmit={onSubmit} />);

    // Fill in required fields
    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(nameInput, { target: { value: "Test User" } });
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    // Submit the form
    const submitButton = screen.getByRole("button", { name: /create member/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    const submittedValues = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(submittedValues?.name).toBe("Test User");
    expect(submittedValues?.email).toBe("test@example.com");
  });

  it("shows submitting state when isSubmitting is true", () => {
    render(
      <EntityEdit
        schema={mockSchema}
        mode="edit"
        initialValues={mockExistingData}
        isSubmitting={true}
        onSubmit={async () => {}}
      />
    );

    const submitButton = screen.getByRole("button", { name: /save changes/i });
    expect(submitButton).toBeDisabled();
  });

  it("shows loading state when isLoading is true", () => {
    render(
      <EntityEdit schema={mockSchema} mode="edit" isLoading={true} onSubmit={async () => {}} />
    );

    // Should show skeleton loading state (not form fields)
    const skeletons = document.querySelectorAll(
      ".animate-pulse, [class*='animate-pulse'], [class*='skeleton']"
    );
    expect(skeletons.length).toBeGreaterThan(0);
    // Form should not be rendered
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("displays validation errors when provided", () => {
    render(
      <EntityEdit
        schema={mockSchema}
        mode="create"
        onSubmit={async () => {}}
        errors={{
          name: "Name is required",
          email: "Please enter a valid email",
        }}
      />
    );

    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Please enter a valid email")).toBeInTheDocument();
  });

  it("calls onValidate when field changes after being touched", async () => {
    const onValidate = vi.fn().mockReturnValue(undefined);
    render(
      <EntityEdit
        schema={mockSchema}
        mode="create"
        onSubmit={async () => {}}
        onValidate={onValidate}
      />
    );

    const nameInput = screen.getByLabelText(/name/i);
    // First change touches the field
    fireEvent.change(nameInput, { target: { value: "Test" } });
    // Second change triggers validation because field is now touched
    fireEvent.change(nameInput, { target: { value: "Test 2" } });

    await waitFor(() => {
      expect(onValidate).toHaveBeenCalledWith("name", "Test 2");
    });
  });

  it("calls onChange when form values change", () => {
    const onChange = vi.fn();
    render(
      <EntityEdit schema={mockSchema} mode="create" onSubmit={async () => {}} onChange={onChange} />
    );

    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "New Name" } });

    expect(onChange).toHaveBeenCalled();
    const changedValues = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as Record<
      string,
      unknown
    >;
    expect(changedValues?.name).toBe("New Name");
  });

  it("renders different widget types correctly", () => {
    render(<EntityEdit schema={mockSchema} mode="create" onSubmit={async () => {}} />);

    // Text input
    expect(screen.getByLabelText(/name/i)).toHaveAttribute("type", "text");

    // Email input
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("type", "email");

    // Password input
    expect(screen.getByLabelText(/password/i)).toHaveAttribute("type", "password");

    // Textarea
    const bioTextarea = screen.getByLabelText(/bio/i);
    expect(bioTextarea.tagName).toBe("TEXTAREA");
  });

  it("renders switch toggle for boolean fields with switch widget", () => {
    render(<EntityEdit schema={mockSchema} mode="create" onSubmit={async () => {}} />);

    // The VIP field uses switch widget
    const vipSwitch = screen.getByRole("switch", { name: /vip member/i });
    expect(vipSwitch).toBeInTheDocument();
  });

  it("renders checkbox for boolean fields with checkbox widget", () => {
    render(<EntityEdit schema={mockSchema} mode="create" onSubmit={async () => {}} />);

    // The newsletter field uses checkbox widget
    const newsletterCheckbox = screen.getByRole("checkbox", { name: /receive newsletter/i });
    expect(newsletterCheckbox).toBeInTheDocument();
  });

  it("renders number input for number widget", () => {
    render(
      <EntityEdit
        schema={mockSchema}
        mode="edit"
        initialValues={mockExistingData}
        onSubmit={async () => {}}
      />
    );

    const pointsInput = screen.getByLabelText(/points/i);
    expect(pointsInput).toHaveAttribute("type", "number");
  });
});

describe("[audit] EntityEdit locale-tabbed-input integration", () => {
  const localeSchema: UIEntitySchema = {
    entityCode: "thing",
    singularName: "Thing",
    pluralName: "Things",
    icon: "Box",
    displayField: "name",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    fields: {
      name: {
        name: "name",
        label: "Name",
        widget: "text",
        displayFormat: "text",
        showInList: true,
        showInDetail: true,
        showInCreate: true,
        showInEdit: true,
      },
      description: {
        name: "description",
        label: "Description",
        widget: "locale-tabbed-input",
        displayFormat: "text",
        showInList: false,
        showInDetail: true,
        showInCreate: true,
        showInEdit: true,
      },
    },
    list: { columns: ["name"], defaultSort: "name", defaultSortDirection: "asc" },
    detail: { groups: [{ id: "g", label: "G", fields: ["name", "description"], order: 1 }] },
    create: { groups: [{ id: "g", label: "G", fields: ["name", "description"], order: 1 }] },
    edit: { groups: [{ id: "g", label: "G", fields: ["name", "description"], order: 1 }] },
  };

  it("renders an element with id=field-description so <Label htmlFor> resolves (WCAG 1.3.1)", () => {
    const { container } = render(
      <EntityEdit schema={localeSchema} mode="create" onSubmit={async () => {}} />
    );

    const label = container.querySelector('label[for="field-description"]');
    expect(label).not.toBeNull();
    const target = container.querySelector("#field-description");
    expect(target).not.toBeNull();
    expect((target as HTMLElement).tagName.toLowerCase()).toMatch(/^(input|textarea)$/);
  });

  it("getDefaultValue returns {} for locale-tabbed-input — submit emits {} not ''", async () => {
    const onSubmit = vi.fn();
    render(<EntityEdit schema={localeSchema} mode="create" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Test" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const submitted = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(submitted.description).toEqual({});
    expect(submitted.description).not.toBe("");
  });
});

describe("[audit] EntityEdit readonly widget label association", () => {
  const readonlySchema: UIEntitySchema = {
    entityCode: "thing",
    singularName: "Thing",
    pluralName: "Things",
    icon: "Box",
    displayField: "name",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    fields: {
      name: {
        name: "name",
        label: "Name",
        widget: "text",
        displayFormat: "text",
        showInList: true,
        showInDetail: true,
        showInCreate: true,
        showInEdit: true,
      },
      computedRef: {
        name: "computedRef",
        label: "Computed Ref",
        widget: "readonly",
        displayFormat: "text",
        showInList: false,
        showInDetail: true,
        showInCreate: true,
        showInEdit: true,
      },
    },
    list: { columns: ["name"], defaultSort: "name", defaultSortDirection: "asc" },
    detail: { groups: [{ id: "g", label: "G", fields: ["name", "computedRef"], order: 1 }] },
    create: { groups: [{ id: "g", label: "G", fields: ["name", "computedRef"], order: 1 }] },
    edit: { groups: [{ id: "g", label: "G", fields: ["name", "computedRef"], order: 1 }] },
  };

  it("uses aria-labelledby pointing at <Label> id (WCAG 1.3.1)", () => {
    const { container } = render(
      <EntityEdit
        schema={readonlySchema}
        mode="edit"
        initialValues={{ name: "x", computedRef: "abc-123" }}
        onSubmit={async () => {}}
      />
    );
    const label = container.querySelector("label#field-computedRef-label");
    expect(label).not.toBeNull();
    const target = container.querySelector('[aria-labelledby="field-computedRef-label"]');
    expect(target).not.toBeNull();
    expect((target as HTMLElement).tagName.toLowerCase()).toBe("div");
  });
});

describe("[audit] EntityEdit metadata-select array label association", () => {
  const arraySchema: UIEntitySchema = {
    entityCode: "thing",
    singularName: "Thing",
    pluralName: "Things",
    icon: "Box",
    displayField: "name",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    fields: {
      name: {
        name: "name",
        label: "Name",
        widget: "text",
        displayFormat: "text",
        showInList: true,
        showInDetail: true,
        showInCreate: true,
        showInEdit: true,
      },
      currencies: {
        name: "currencies",
        label: "Currencies",
        widget: "metadata-select",
        metadataType: "FIAT_CURRENCY_TYPE",
        displayFormat: "tags",
        showInList: false,
        showInDetail: true,
        showInCreate: true,
        showInEdit: true,
      },
    },
    list: { columns: ["name"], defaultSort: "name", defaultSortDirection: "asc" },
    detail: { groups: [{ id: "g", label: "G", fields: ["name", "currencies"], order: 1 }] },
    create: { groups: [{ id: "g", label: "G", fields: ["name", "currencies"], order: 1 }] },
    edit: { groups: [{ id: "g", label: "G", fields: ["name", "currencies"], order: 1 }] },
  };

  it("array fallback <div> uses aria-labelledby pointing at <Label> id (WCAG 1.3.1)", () => {
    const { container } = render(
      <EntityEdit
        schema={arraySchema}
        mode="edit"
        initialValues={{ name: "x", currencies: ["USD", "EUR"] }}
        onSubmit={async () => {}}
      />
    );
    const label = container.querySelector("label#field-currencies-label");
    expect(label).not.toBeNull();
    const target = container.querySelector('[aria-labelledby="field-currencies-label"]');
    expect(target).not.toBeNull();
    expect((target as HTMLElement).tagName.toLowerCase()).toBe("div");
  });
});

describe("EntityEdit read-only", () => {
  it("disables submit and explains why while the app is read-only", () => {
    const onSubmit = vi.fn(async () => {});
    render(
      <ReadOnlyProvider reason="Your trial has ended.">
        <EntityEdit schema={mockSchema} mode="create" onSubmit={onSubmit} />
      </ReadOnlyProvider>
    );

    const submit = screen.getByRole("button", { name: /create member/i });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAccessibleDescription("Your trial has ended.");

    fireEvent.submit(submit.closest("form")!);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
