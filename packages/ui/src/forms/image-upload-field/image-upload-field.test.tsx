import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ImageUploadField, type ImageUploadFieldProps } from "./image-upload-field";

function Controlled(
  props: Omit<ImageUploadFieldProps, "value" | "onChange"> & { initial?: string }
) {
  const { initial = "", ...rest } = props;
  const [value, setValue] = useState(initial);
  return <ImageUploadField {...rest} value={value} onChange={setValue} />;
}

const png = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "logo.png", { type: "image/png" });

const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;

describe("ImageUploadField", () => {
  it("is a plain URL field without an upload handler", () => {
    render(<Controlled label="Logo" initial="https://example.com/logo.png" />);

    expect(screen.getByLabelText("Logo")).toHaveValue("https://example.com/logo.png");
    expect(screen.getByRole("img", { name: "Logo preview" })).toHaveAttribute(
      "src",
      "https://example.com/logo.png"
    );
    expect(screen.queryByRole("button", { name: /upload/i })).not.toBeInTheDocument();
  });

  it("fills the field with the uploaded file's URL", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockResolvedValue("https://assets.loomloyalty.com/orgs/o/1.png");
    render(<Controlled label="Logo" onUpload={onUpload} />);

    await user.upload(fileInput(), png());

    expect(onUpload).toHaveBeenCalledOnce();
    expect(onUpload.mock.calls[0]![0]).toBeInstanceOf(File);
    expect(
      await screen.findByDisplayValue("https://assets.loomloyalty.com/orgs/o/1.png")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload Logo" })).not.toHaveAttribute(
      "aria-disabled"
    );
  });

  it("shows an upload failure inline and keeps the previous value", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockRejectedValue(new Error("boom"));
    render(
      <Controlled
        label="Logo"
        initial="https://example.com/old.png"
        onUpload={onUpload}
        describeUploadError={() => "The file is not a PNG, JPEG or WebP image"}
      />
    );

    await user.upload(fileInput(), png());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The file is not a PNG, JPEG or WebP image"
    );
    expect(screen.getByLabelText("Logo")).toHaveValue("https://example.com/old.png");
    expect(screen.getByLabelText("Logo")).toHaveAttribute("aria-invalid", "true");
  });

  it("clears the upload error once the URL is edited", async () => {
    const user = userEvent.setup();
    render(
      <Controlled label="Logo" onUpload={vi.fn().mockRejectedValue(new Error("Too large"))} />
    );

    await user.upload(fileInput(), png());
    expect(await screen.findByRole("alert")).toHaveTextContent("Too large");

    await user.type(screen.getByLabelText("Logo"), "h");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("names each Upload button after its field and hides the file input from assistive tech", () => {
    render(<Controlled label="Logo" onUpload={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Upload Logo" })).toBeInTheDocument();
    expect(fileInput()).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the button focusable and announces the upload while it runs", async () => {
    const user = userEvent.setup();
    let finish: (url: string) => void = () => {};
    const onUpload = vi.fn(() => new Promise<string>((resolve) => (finish = resolve)));
    render(<Controlled label="Logo" onUpload={onUpload} />);

    await user.upload(fileInput(), png());

    const button = screen.getByRole("button", { name: "Upload Logo" });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Uploading Logo…");

    await user.click(button);
    expect(onUpload).toHaveBeenCalledOnce();

    finish("https://assets.loomloyalty.com/orgs/o/2.png");
    expect(
      await screen.findByDisplayValue("https://assets.loomloyalty.com/orgs/o/2.png")
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
