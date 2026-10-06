"use client";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { date, errorMessage, send } from "@/lib/api";
import { useSession } from "./session";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import {
  BusyButton,
  DataTable,
  ErrorState,
  Field,
  FormError,
  Loading,
  Panel,
  Pill,
  Status,
} from "./common";
type Preference = {
  sms: boolean;
  whatsapp: boolean;
  email: boolean;
  emailAddress: string;
  newArrivals: boolean;
  stockAlerts: boolean;
  inquiryAlerts: boolean;
  paymentReminders: boolean;
};
type SettingsData = {
  preference: Preference;
  providers: { mode: string; email: boolean; sms: boolean; whatsapp: boolean };
  deliveries: {
    id: string;
    channel: string;
    title: string;
    status: string;
    createdAt: string;
    lastError: string;
  }[];
};
export function NotificationSettings() {
  const { data, error, mutate } = useSWR<SettingsData>(
    "/notification-settings",
    { refreshInterval: 15000 },
  );
  if (error)
    return (
      <ErrorState
        error={error}
        retry={() => {
          void mutate();
        }}
      />
    );
  if (!data) return <Loading />;
  return (
    <div className="mb-5 space-y-5">
      <PreferencesForm
        key={JSON.stringify(data.preference)}
        data={data}
        onSaved={() => {
          void mutate();
        }}
      />
      {!!data.deliveries.length && (
        <Panel
          title="External alert history"
          description="Accepted means the provider acknowledged the request; final delivery is tracked in its dashboard."
        >
          <DataTable
            rows={data.deliveries}
            rowKey={(d) => d.id}
            pageSize={5}
            columns={[
              {
                key: "title",
                label: "Alert",
                render: (d) => (
                  <>
                    {d.title}
                    <span className="block text-xs text-muted-foreground">
                      {d.lastError}
                    </span>
                  </>
                ),
              },
              { key: "channel", label: "Channel", render: (d) => d.channel },
              {
                key: "status",
                label: "Status",
                render: (d) => <Status value={d.status} />,
              },
              {
                key: "date",
                label: "Created",
                render: (d) => date(d.createdAt),
              },
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
function PreferencesForm({
  data,
  onSaved,
}: {
  data: SettingsData;
  onSaved: () => void;
}) {
  const { user } = useSession();
  const [draft, setDraft] = useState(data.preference),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const channelOptions: [keyof Preference, string][] = [
    ["sms", "SMS to your login mobile"],
    ["whatsapp", "WhatsApp to your login mobile"],
    ["email", "Email alerts"],
  ];
  const topics: [keyof Preference, string][] = [
    ["newArrivals", "New arrivals from saved suppliers"],
    ["inquiryAlerts", "Inquiry and sourcing status updates"],
    ["paymentReminders", "Payment reminders from suppliers"],
  ];
  if (user?.businessId)
    topics.splice(0, 1, ["stockAlerts", "Low stock / stock-out alerts"]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send("/notification-settings", draft, "PATCH");
      toast.success("Alert preferences saved");
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title="Alert preferences"
      action={
        <Pill tone={data.providers.mode === "local" ? "warning" : "success"}>
          {data.providers.mode === "local"
            ? "Local mode · no external sending"
            : "Live provider mode"}
        </Pill>
      }
    >
      <form onSubmit={save} className="space-y-5 border-t p-5">
        <fieldset disabled={busy} className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold">Delivery channels</p>
            {channelOptions.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={draft[key] === true}
                  onCheckedChange={(v) =>
                    setDraft((d) => ({ ...d, [key]: v === true }))
                  }
                />
                {label}
              </label>
            ))}
            <Field label="Email address">
              <Input
                type="email"
                required={draft.email}
                maxLength={200}
                value={draft.emailAddress}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, emailAddress: e.target.value }))
                }
                placeholder="you@business.com"
              />
            </Field>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold">Alerts you allow</p>
            {topics.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={draft[key] === true}
                  onCheckedChange={(v) =>
                    setDraft((d) => ({ ...d, [key]: v === true }))
                  }
                />
                {label}
              </label>
            ))}
            <p className="text-xs leading-5 text-muted-foreground">
              Selecting a channel and topic opts you in. Turn them off any time.
              SMS/WhatsApp use your verified login mobile, +91 {user?.phone}.
            </p>
          </div>
        </fieldset>
        <p className="text-xs leading-5 text-muted-foreground">
          Provider readiness: email{" "}
          {data.providers.email ? "configured" : "pending"} · SMS{" "}
          {data.providers.sms ? "configured" : "pending"} · WhatsApp{" "}
          {data.providers.whatsapp ? "configured" : "pending"}. Messages wait
          until the matching provider and approved template are configured.
        </p>
        <FormError message={error} />
        <BusyButton busy={busy} type="submit">
          <Check />
          Save alert preferences
        </BusyButton>
      </form>
    </Panel>
  );
}
