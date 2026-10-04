import { actions, modules, type StaffPermissionMap } from "@/lib/permissions";

type PermissionMatrixProps = {
  permissions: StaffPermissionMap;
};

export function PermissionMatrix({ permissions }: PermissionMatrixProps) {
  return (
    <div className="permission-grid">
      <div className="permission-row">
        <strong>Module</strong>
        {actions.map((action) => (
          <strong className="permission-cell" key={action}>
            {action}
          </strong>
        ))}
      </div>
      {modules.map((module) => (
        <div className="permission-row" key={module}>
          <strong>{module}</strong>
          {actions.map((action) => {
            const allowed = permissions[module].includes(action);
            return (
              <span className={`permission-cell ${allowed ? "permission-cell--on" : ""}`} key={action}>
                {allowed ? "Allowed" : "-"}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
