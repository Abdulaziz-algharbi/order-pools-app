import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { createOffer } from "@/mocks/api";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/Field";
import type { SupplierUser } from "@/types/domain";

const CATEGORIES = ["Grocery", "Household", "Beauty", "Electronics", "Textiles", "Other"];

interface FormState {
  productName: string;
  productDescription: string;
  category: string;
  targetQuantity: string;
  unit: string;
  minContribution: string;
  unitPrice: string;
  proposedDeadline: string;
}

const initialState: FormState = {
  productName: "",
  productDescription: "",
  category: CATEGORIES[0],
  targetQuantity: "",
  unit: "",
  minContribution: "",
  unitPrice: "",
  proposedDeadline: "",
};

export function CreateOfferPage() {
  const { user } = useAuth();
  const supplier = user as SupplierUser;
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
    if (!form.productName.trim()) next.productName = "Product name is required.";
    if (!form.productDescription.trim()) next.productDescription = "Description is required.";
    if (!form.unit.trim()) next.unit = "Unit is required (e.g. bottles, sacks).";
    const target = Number(form.targetQuantity);
    if (!target || target <= 0) next.targetQuantity = "Enter a target quantity greater than 0.";
    const minContrib = Number(form.minContribution);
    if (!minContrib || minContrib <= 0) next.minContribution = "Enter a minimum contribution greater than 0.";
    else if (target && minContrib > target) next.minContribution = "Cannot exceed the target quantity.";
    const price = Number(form.unitPrice);
    if (!price || price <= 0) next.unitPrice = "Enter a unit price greater than 0.";
    if (!form.proposedDeadline) next.proposedDeadline = "Proposed deadline is required.";
    else if (new Date(form.proposedDeadline).getTime() <= Date.now()) next.proposedDeadline = "Deadline must be in the future.";

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
        supplierId: supplier.id,
        supplierName: supplier.companyName,
        productName: form.productName.trim(),
        productDescription: form.productDescription.trim(),
        category: form.category,
        targetQuantity: Number(form.targetQuantity),
        unit: form.unit.trim(),
        minContribution: Number(form.minContribution),
        unitPrice: Number(form.unitPrice),
        proposedDeadline: new Date(form.proposedDeadline).toISOString(),
      });
      navigate("/supplier/offers");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not submit offer.");
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
            This will be sent to an administrator for review before it becomes an active pool.
          </p>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <FieldWrapper label="Product name" htmlFor="productName" error={errors.productName} required>
              <Input id="productName" value={form.productName} onChange={update("productName")} hasError={!!errors.productName} />
            </FieldWrapper>

            <FieldWrapper label="Description" htmlFor="productDescription" error={errors.productDescription} required>
              <Textarea
                id="productDescription"
                rows={3}
                value={form.productDescription}
                onChange={update("productDescription")}
                hasError={!!errors.productDescription}
              />
            </FieldWrapper>

            <FieldWrapper label="Category" htmlFor="category" required>
              <Select id="category" value={form.category} onChange={update("category")}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FieldWrapper>

            <div className="grid grid-cols-2 gap-4">
              <FieldWrapper label="Target quantity" htmlFor="targetQuantity" error={errors.targetQuantity} required>
                <Input
                  id="targetQuantity"
                  type="number"
                  min={1}
                  value={form.targetQuantity}
                  onChange={update("targetQuantity")}
                  hasError={!!errors.targetQuantity}
                />
              </FieldWrapper>
              <FieldWrapper label="Unit" htmlFor="unit" error={errors.unit} hint="e.g. bottles, sacks, units" required>
                <Input id="unit" value={form.unit} onChange={update("unit")} hasError={!!errors.unit} />
              </FieldWrapper>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FieldWrapper label="Minimum contribution" htmlFor="minContribution" error={errors.minContribution} required>
                <Input
                  id="minContribution"
                  type="number"
                  min={1}
                  value={form.minContribution}
                  onChange={update("minContribution")}
                  hasError={!!errors.minContribution}
                />
              </FieldWrapper>
              <FieldWrapper label="Unit price (USD)" htmlFor="unitPrice" error={errors.unitPrice} required>
                <Input
                  id="unitPrice"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={form.unitPrice}
                  onChange={update("unitPrice")}
                  hasError={!!errors.unitPrice}
                />
              </FieldWrapper>
            </div>

            <FieldWrapper label="Proposed deadline" htmlFor="proposedDeadline" error={errors.proposedDeadline} required>
              <Input
                id="proposedDeadline"
                type="date"
                value={form.proposedDeadline}
                onChange={update("proposedDeadline")}
                hasError={!!errors.proposedDeadline}
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
