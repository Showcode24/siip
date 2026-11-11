"use client";

// Where a company is and how it is registered. Shared by registration and
// settings: Nigerian companies give a CAC number and state; companies anywhere
// else give their own business registration number.
import { countryOptions } from "@siip/shared/countries";
import { NIGERIAN_STATES } from "@siip/shared/nigeria";
import { timeZoneOptions } from "@siip/shared/timezones";
import { useMemo } from "react";
import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Combobox } from "@/components/ui/combobox";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/form-controls";

export interface CompanyPlaceValues {
  country?: string | null;
  city?: string | null;
  timeZone?: string | null;
  rcNumber?: string | null;
  businessRegNumber?: string | null;
  state?: string | null;
}

const COUNTRIES = countryOptions().map((c) => ({ value: c.code, label: c.name }));

export function CompanyPlaceFields({
  control,
  register,
  errors,
  country,
  locked = false,
}: {
  control: Control<CompanyPlaceValues>;
  register: UseFormRegister<CompanyPlaceValues>;
  errors: FieldErrors<CompanyPlaceValues>;
  /** The country currently chosen in the form. */
  country: string | null | undefined;
  /** Verified companies can't change their country or registration number. */
  locked?: boolean;
}) {
  const zones = useMemo(() => timeZoneOptions(), []);
  const nigeria = country === "NG";
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Country"
          hint={locked ? "Contact SIIP to change the country of a verified company." : undefined}
          error={errors.country?.message}
          required
        >
          <Controller
            control={control}
            name="country"
            render={({ field }) =>
              locked ? (
                <Input disabled value={COUNTRIES.find((c) => c.value === field.value)?.label ?? ""} readOnly />
              ) : (
                <Combobox
                  options={COUNTRIES}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Search countries"
                  emptyText="No country by that name"
                />
              )
            }
          />
        </Field>
        <Field label="City" error={errors.city?.message} required>
          <Input autoComplete="address-level2" {...register("city")} />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Time zone" hint="Used for meeting times and deadlines." error={errors.timeZone?.message} required>
          <Controller
            control={control}
            name="timeZone"
            render={({ field }) => (
              <Combobox
                options={zones}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Search time zones"
                emptyText="No time zone by that name"
              />
            )}
          />
        </Field>
        {country ? (
          nigeria ? (
            <Field
              label="CAC registration number"
              hint="e.g. RC1234567 or BN1234567"
              error={errors.rcNumber?.message}
              required
            >
              <Input
                disabled={locked}
                className="uppercase"
                {...register("rcNumber", { setValueAs: (v) => (v === "" ? null : v) })}
              />
            </Field>
          ) : (
            <Field
              label="Business registration number"
              hint="The number your company is registered under in its country."
              error={errors.businessRegNumber?.message}
              required
            >
              <Input
                disabled={locked}
                {...register("businessRegNumber", { setValueAs: (v) => (v === "" ? null : v) })}
              />
            </Field>
          )
        ) : null}
      </div>
      {nigeria ? (
        <Field label="State" error={errors.state?.message} required>
          <Select {...register("state", { setValueAs: (v) => (v === "" ? null : v) })}>
            <option value="">Choose a state</option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s === "FCT" ? "FCT (Abuja)" : s}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
    </>
  );
}
