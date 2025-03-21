"use client";

import React, { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { LoadingSpinner } from "./LoadingSpinner";
import { AddressAutocomplete } from "./AddressAutocomplete";

// Types
type LocationEntry = {
  address: string;
  driveTime: string;
};

type SearchFormValues = {
  locations: LocationEntry[];
  budget: {
    maxPerMonth: number;
    downPaymentPercent: number;
  };
};

type SearchFormProps = {
  onSubmit?: (data: SearchFormValues) => void;
};

// Validation schema
const schema = yup.object().shape({
  locations: yup
    .array()
    .of(
      yup.object().shape({
        address: yup.string().required("Address is required"),
        driveTime: yup.string().required("Drive time is required"),
      })
    )
    .min(1, "At least one location is required")
    .max(10, "Maximum 10 locations allowed"),
  budget: yup.object().shape({
    maxPerMonth: yup
      .number()
      .typeError("Monthly budget must be a number")
      .positive("Monthly budget must be positive")
      .required("Monthly budget is required"),
    downPaymentPercent: yup
      .number()
      .typeError("Down payment must be a number")
      .min(0, "Down payment must be at least 0%")
      .max(100, "Down payment cannot exceed 100%")
      .required("Down payment percentage is required"),
  }),
});

// Drive time options
const driveTimeOptions = ["5 min", "10 min", "15 min", "20 min", "30 min", "45 min", "60 min"];

export function SearchForm({ onSubmit: externalSubmit }: SearchFormProps) {
  const [isSearching, setIsSearching] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SearchFormValues>({
    resolver: yupResolver(schema),
    defaultValues: {
      locations: [{ address: "", driveTime: "15 min" }],
      budget: {
        maxPerMonth: 3000,
        downPaymentPercent: 3.5,
      },
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "locations",
  });

  const onSubmit = async (data: SearchFormValues) => {
    setIsSearching(true);

    try {
      if (externalSubmit) {
        // Use the external submit handler if provided
        externalSubmit(data);
      } else {
        // Default submit behavior if no external handler
        const response = await fetch("/api/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
      }
    } catch (error) {
      console.error("Error searching properties:", error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Locations (Max 10)</h2>
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-col md:flex-row gap-4">
              <div className="flex-grow">
                <label className="block text-sm font-medium mb-1">Address {index + 1}</label>
                <Controller
                  name={`locations.${index}.address`}
                  control={control}
                  render={({ field }) => (
                    <AddressAutocomplete
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.locations?.[index]?.address?.message}
                    />
                  )}
                />
              </div>

              <div className="w-full md:w-1/4">
                <label className="block text-sm font-medium mb-1">Drive Time</label>
                <select
                  {...register(`locations.${index}.driveTime`)}
                  className="w-full p-2 border rounded-md"
                >
                  {driveTimeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {errors.locations?.[index]?.driveTime && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.locations[index]?.driveTime?.message}
                  </p>
                )}
              </div>

              {index > 0 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="self-end mb-1 p-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          {fields.length < 10 && (
            <button
              type="button"
              onClick={() => append({ address: "", driveTime: "15 min" })}
              className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Add Location
            </button>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Budget</h2>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-grow">
              <label className="block text-sm font-medium mb-1">Maximum Monthly Payment</label>
              <div className="relative">
                <span className="absolute left-3 top-2">$</span>
                <input
                  {...register("budget.maxPerMonth")}
                  type="number"
                  className="w-full p-2 pl-6 border rounded-md"
                  placeholder="3000"
                />
              </div>
              {errors.budget?.maxPerMonth && (
                <p className="text-red-500 text-sm mt-1">{errors.budget.maxPerMonth.message}</p>
              )}
            </div>

            <div className="flex-grow">
              <label className="block text-sm font-medium mb-1">Down Payment Percentage</label>
              <div className="relative">
                <input
                  {...register("budget.downPaymentPercent")}
                  type="number"
                  step="0.1"
                  className="w-full p-2 pr-6 border rounded-md"
                  placeholder="3.5"
                />
                <span className="absolute right-3 top-2">%</span>
              </div>
              {errors.budget?.downPaymentPercent && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.budget.downPaymentPercent.message}
                </p>
              )}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSearching}
          className={`w-full p-3 ${
            isSearching ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
          } text-white font-medium rounded-md`}
        >
          {isSearching ? "Searching..." : "Search Properties"}
        </button>
      </form>

      {isSearching && (
        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
          <LoadingSpinner size="lg" text="Searching properties that match your criteria..." />
        </div>
      )}
    </div>
  );
}
