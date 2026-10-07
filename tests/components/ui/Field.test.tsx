import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/Field";

// A field's error is shown as red text, which a screen reader can't see:
// the field itself must say it's invalid and be described by the message.
describe("FieldWrapper with its field", () => {
  it("marks a field with an error invalid and reads the error with it", () => {
    render(
      <FieldWrapper label="Price" htmlFor="price" error="Must be at least 0.100 OMR." hint="Per lot.">
        <Input id="price" />
      </FieldWrapper>,
    );
    const field = screen.getByLabelText(/Price/);

    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Must be at least 0.100 OMR.");
  });

  it("reads a hint with the field without marking it invalid", () => {
    render(
      <FieldWrapper label="Price" htmlFor="price" hint="Per lot.">
        <Input id="price" />
      </FieldWrapper>,
    );
    const field = screen.getByLabelText(/Price/);

    expect(field).not.toHaveAttribute("aria-invalid");
    expect(field).toHaveAccessibleDescription("Per lot.");
  });

  it("leaves a field with neither undescribed", () => {
    render(
      <FieldWrapper label="Price" htmlFor="price">
        <Input id="price" />
      </FieldWrapper>,
    );

    expect(screen.getByLabelText(/Price/)).not.toHaveAttribute("aria-describedby");
  });

  // Errors that appear as the user types (the approve form) are announced.
  it("puts the error in a polite live region", () => {
    render(
      <FieldWrapper label="Price" htmlFor="price" error="Below cost.">
        <Input id="price" />
      </FieldWrapper>,
    );

    expect(screen.getByText("Below cost.").closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });

  it.each([
    ["a select", <Select id="f" key="s" />],
    ["a textarea", <Textarea id="f" key="t" />],
  ])("does the same for %s", (_name, control) => {
    render(
      <FieldWrapper label="Field" htmlFor="f" error="Required.">
        {control}
      </FieldWrapper>,
    );
    const field = screen.getByLabelText(/Field/);

    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Required.");
  });

  // e.g. the address block inside the join form's "Delivery address".
  it("only describes the wrapper's own field, not one nested deeper", () => {
    render(
      <FieldWrapper label="Address" htmlFor="address" error="Add an address.">
        <Input id="city" aria-label="City" />
      </FieldWrapper>,
    );
    const city = screen.getByLabelText("City");

    expect(city).not.toHaveAttribute("aria-invalid");
    expect(city).not.toHaveAttribute("aria-describedby");
  });

  it("keeps a description the page set itself", () => {
    render(
      <>
        <p id="extra">Shown on the receipt.</p>
        <FieldWrapper label="Price" htmlFor="price" hint="Per lot.">
          <Input id="price" aria-describedby="extra" />
        </FieldWrapper>
      </>,
    );

    expect(screen.getByLabelText(/Price/)).toHaveAccessibleDescription("Shown on the receipt. Per lot.");
  });
});

describe("a field on its own", () => {
  it("is marked invalid by hasError", () => {
    render(<Input aria-label="Quantity" hasError />);

    expect(screen.getByLabelText("Quantity")).toHaveAttribute("aria-invalid", "true");
  });
});
