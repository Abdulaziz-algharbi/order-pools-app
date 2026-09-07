import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createOffer } from "@/mocks/api";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/Field";
import { ApiError } from "@/lib/http";
import type { ProductOfferUnit } from "@/types/domain";

const UNITS: ProductOfferUnit[] = ["PIECE", "KG", "BOX", "CARTON"];

interface FormState {
  name: string;
  description: string;
  brand: string;
  unit: ProductOfferUnit;
  images: string;
  wholeQuantity: string;
  price: string;
}

const initialState: FormState = {
  name: "",
  description: "",
  brand: "",
  unit: "PIECE",
  images: "",
  wholeQuantity: "",
  price: "",
};

export function CreateOfferPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const update = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = "Product name is required.";
    if (!form.description.trim()) next.description = "Description is required.";
    const quantity = Number(form.wholeQuantity);
    if (!quantity || quantity <= 0) next.wholeQuantity = "Enter a quantity greater than 0.";
    const price = Number(form.price);
    if (!price || price <= 0) next.price = "Enter a price greater than 0.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await createOffer({
        name: form.name.trim(),
        description: form.description.trim(),
        brand: form.brand.trim() || undefined,
        unit: form.unit,
        images: form.images.trim() || undefined,
        wholeQuantity: Number(form.wholeQuantity),
        price: Number(form.price),
      });
      navigate("/supplier/offers");
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Could not submit offer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/supplier/offers" className="mb-4 inline-block text-sm font-medium text-tertiary hover:underline">
        &larr; Back to offers
      </Link>

      <Card>
        <CardContent>
          <h1 className="mb-1 font-heading text-xl font-semibold text-primary">New supplier offer</h1>
          <p className="mb-6 text-sm text-slate-500">
            This will be sent to an administrator for review before it can become an active pool.
          </p>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <FieldWrapper label="Product name" htmlFor="name" error={errors.name} required>
              <Input id="name" value={form.name} onChange={update("name")} hasError={!!errors.name} />
            </FieldWrapper>

            <FieldWrapper label="Brand" htmlFor="brand" hint="Optional">
              <Input id="brand" value={form.brand} onChange={update("brand")} />
            </FieldWrapper>

            <FieldWrapper label="Description" htmlFor="description" error={errors.description} required>
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={update("description")}
                hasError={!!errors.description}
              />
            </FieldWrapper>

            <FieldWrapper label="Image URL" htmlFor="images" hint="Optional">
              <Input id="images" value={form.images} onChange={update("images")} placeholder="https://…" />
            </FieldWrapper>

            <div className="grid grid-cols-2 gap-4">
              <FieldWrapper label="Quantity" htmlFor="wholeQuantity" error={errors.wholeQuantity} required>
                <Input
                  id="wholeQuantity"
                  type="number"
                  min={1}
                  value={form.wholeQuantity}
                  onChange={update("wholeQuantity")}
                  hasError={!!errors.wholeQuantity}
                />
              </FieldWrapper>
              <FieldWrapper label="Unit" htmlFor="unit" required>
                <Select id="unit" value={form.unit} onChange={update("unit")}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </FieldWrapper>
            </div>

            <FieldWrapper label="Price per unit (OMR)" htmlFor="price" error={errors.price} required>
              <Input
                id="price"
                type="number"
                min={0.01}
                step="0.01"
                value={form.price}
                onChange={update("price")}
                hasError={!!errors.price}
              />
            </FieldWrapper>

            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate("/supplier/offers")} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting}>
                Submit offer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
