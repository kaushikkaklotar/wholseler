import { PageHeader } from "@/components/page-header";
import { PermissionMatrix } from "@/components/permission-matrix";
import { SimpleTable } from "@/components/simple-table";
import { StaffCreateForm } from "@/components/staff-create-form";
import { StatusBadge } from "@/components/status-badge";
import { staffMembers } from "@/lib/demo-data";
import { currentPlan, getStaffLimitState } from "@/lib/subscription";

export default function StaffPage() {
  const activeStaff = staffMembers.filter((staff) => staff.status === "Active").length;
  const staffLimit = getStaffLimitState(activeStaff, currentPlan);
  const selectedStaff = staffMembers[0];

  return (
    <>
      <PageHeader
        eyebrow="Owner panel"
        title="Staff management"
        description="Create staff accounts, control module-wise permissions and enforce staff count by subscription plan."
        action={<button className="button button--primary">Create staff</button>}
      />

      <section className="staff-layout">
        <article className="card">
          <div className="card__header">
            <div>
              <h2>Staff accounts</h2>
              <p>
                {activeStaff} active of {currentPlan.staffLimit} allowed on {currentPlan.name} plan.
              </p>
            </div>
            <StatusBadge label={staffLimit.isAtLimit ? "Limit reached" : "Active"} />
          </div>
          <div className="card__body">
            <div className="progress" aria-label="Staff limit usage">
              <span style={{ width: `${staffLimit.percentage}%` }} />
            </div>
            <p className="table-note">
              {staffLimit.remaining} more staff accounts can be activated before plan upgrade is required.
            </p>
            <SimpleTable
              data={staffMembers}
              columns={[
                { label: "Name", render: (item) => item.name },
                { label: "Phone", render: (item) => item.phone },
                { label: "Role", render: (item) => item.designation },
                { label: "Status", render: (item) => <StatusBadge label={item.status} /> },
                { label: "Last active", render: (item) => item.lastActive }
              ]}
            />
          </div>
        </article>

        <aside className="card">
          <div className="card__header">
            <div>
              <h2>Create staff</h2>
              <p>Owner can later edit permissions anytime.</p>
            </div>
          </div>
          <StaffCreateForm />
        </aside>
      </section>

      <section className="card section-gap">
        <div className="card__header">
          <div>
            <h2>Permission matrix</h2>
            <p>{selectedStaff.name} can access only the selected modules and actions.</p>
          </div>
          <button className="button button--secondary">Edit permissions</button>
        </div>
        <div className="card__body">
          <PermissionMatrix permissions={selectedStaff.permissions} />
        </div>
      </section>
    </>
  );
}
