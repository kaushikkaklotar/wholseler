"use client";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { date, errorMessage, send } from "@/lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  BusyButton,
  DataTable,
  ErrorState,
  Field,
  FormError,
  Loading,
  Panel,
  Status,
} from "./common";
type Task = {
  id: string;
  title: string;
  category: string;
  status: string;
  assigneeId: string | null;
  assignee: { name: string } | null;
  dueAt: string | null;
  note: string;
};
type OperationsData = {
  business: { onboardingStage: string; verificationStatus: string };
  tasks: Task[];
  team: { id: string; name: string }[];
  stages: string[];
};
export function OperationsTasks({
  businessId,
  onSaved,
}: {
  businessId: string;
  onSaved: () => void;
}) {
  const key = `/platform/businesses/${businessId}/operations`;
  const { data, error, mutate } = useSWR<OperationsData>(key);
  const [edit, setEdit] = useState<Task | null | undefined>(undefined),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function stage(next: string) {
    setBusy(true);
    setMessage("");
    try {
      await send(`${key}/stage`, { stage: next }, "PATCH");
      await mutate();
      onSaved();
      toast.success("Onboarding stage updated");
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
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
    <div className="space-y-4">
      <Panel
        title="Onboarding progress"
        description="Track assisted setup separately from business verification."
      >
        <div className="space-y-3 border-t p-5">
          <Field label="Current stage">
            <select
              disabled={busy}
              className="field"
              value={data.business.onboardingStage}
              onChange={(e) => {
                void stage(e.target.value);
              }}
            >
              {data.stages.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-muted-foreground">
            Ready requires an approved business, a published catalog entry and
            no unfinished tasks.
          </p>
          <FormError message={message} />
        </div>
      </Panel>
      <Panel
        title="Data entry & setup tasks"
        action={
          <Button size="sm" onClick={() => setEdit(null)}>
            <Plus />
            Add task
          </Button>
        }
      >
        <DataTable
          rows={data.tasks}
          rowKey={(t) => t.id}
          pageSize={5}
          emptyTitle="No setup tasks"
          emptyDescription="Assign catalog, stock, document and training work to the platform team."
          columns={[
            {
              key: "title",
              label: "Task",
              render: (t) => (
                <>
                  <button
                    className="text-left font-medium text-primary"
                    onClick={() => setEdit(t)}
                  >
                    {t.title}
                  </button>
                  <span className="block text-xs text-muted-foreground">
                    {t.category.toLowerCase()}
                  </span>
                </>
              ),
            },
            {
              key: "assignee",
              label: "Assigned to",
              render: (t) => t.assignee?.name || "Unassigned",
            },
            {
              key: "status",
              label: "Status",
              render: (t) => <Status value={t.status} />,
            },
            {
              key: "due",
              label: "Due",
              render: (t) => (t.dueAt ? date(t.dueAt) : "—"),
            },
          ]}
        />
      </Panel>
      {edit !== undefined && (
        <TaskForm
          key={edit?.id || "new"}
          task={edit}
          team={data.team}
          apiPath={key}
          onClose={() => setEdit(undefined)}
          onSaved={() => {
            setEdit(undefined);
            void mutate();
            onSaved();
          }}
        />
      )}
    </div>
  );
}
function TaskForm({
  task,
  team,
  apiPath,
  onClose,
  onSaved,
}: {
  task: Task | null;
  team: OperationsData["team"];
  apiPath: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(task?.title || ""),
    [category, setCategory] = useState(task?.category || "CATALOG"),
    [status, setStatus] = useState(task?.status || "TODO"),
    [assigneeId, setAssignee] = useState(task?.assigneeId || ""),
    [due, setDue] = useState(task?.dueAt?.slice(0, 10) || ""),
    [note, setNote] = useState(task?.note || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send(
        `${apiPath}/tasks${task ? `/${task.id}` : ""}`,
        {
          title,
          category,
          status,
          assigneeId: assigneeId || null,
          dueAt: due ? new Date(`${due}T12:00:00+05:30`).toISOString() : null,
          note,
        },
        task ? "PATCH" : "POST",
      );
      toast.success("Setup task saved");
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title={task ? "Edit setup task" : "New setup task"}>
      <form onSubmit={save} className="space-y-4 border-t p-5">
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <Field label="Task title" required>
            <Input
              required
              minLength={3}
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Category">
            <select
              className="field"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {["PROFILE", "DOCUMENTS", "CATALOG", "STOCK", "TRAINING"].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
          </Field>
          <Field label="Status">
            <select
              className="field"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {["TODO", "IN_PROGRESS", "BLOCKED", "DONE"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Assigned to">
            <select
              className="field"
              value={assigneeId}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Unassigned</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <Input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </Field>
          <Field label="Notes">
            <Textarea
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </fieldset>
        <FormError message={error} />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <BusyButton busy={busy} type="submit">
            <Check />
            Save task
          </BusyButton>
        </div>
      </form>
    </Panel>
  );
}
