"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createStaffAction, type StaffActionState } from "@/app/dashboard/staff/actions";

const initialState: StaffActionState = {
  ok: false,
  message: ""
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button button--primary" disabled={pending} type="submit">
      {pending ? "Saving..." : "Save staff"}
    </button>
  );
}

export function StaffCreateForm() {
  const [state, formAction] = useActionState(createStaffAction, initialState);

  return (
    <form action={formAction} className="card__body form-card">
      <input name="wholesalerId" type="hidden" value="demo-wholesaler" />
      <div className="field">
        <label htmlFor="staff-name">Name</label>
        <input id="staff-name" name="name" placeholder="Staff full name" required />
      </div>
      <div className="field">
        <label htmlFor="staff-phone">Mobile number</label>
        <input id="staff-phone" name="phone" placeholder="+91 90000 00000" required />
      </div>
      <div className="field">
        <label htmlFor="staff-role">Work area</label>
        <select id="staff-role" name="designation" defaultValue="Billing">
          <option>Billing</option>
          <option>Catalog</option>
          <option>Inventory</option>
          <option>Reports only</option>
        </select>
      </div>
      <SubmitButton />
      <p aria-live="polite" className={state.ok ? "metric-card__trend" : "muted"}>
        {state.message}
      </p>
    </form>
  );
}
