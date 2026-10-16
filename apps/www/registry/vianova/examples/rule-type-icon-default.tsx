import {
  RULE_TYPE_ORDER,
  RULE_TYPES,
  RuleTypeIcon,
} from "@/registry/vianova/product/rule-type-icon";

export default function RuleTypeIconDefault() {
  return (
    <div className="w-full max-w-2xl space-y-6">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {RULE_TYPE_ORDER.map((type) => (
          <li key={type} className="flex items-start gap-3">
            <RuleTypeIcon type={type} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{RULE_TYPES[type].label}</p>
              <p className="text-xs text-muted-foreground">{RULE_TYPES[type].description}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-end gap-4">
        <RuleTypeIcon type="no_parking" size="sm" label="No parking, small" />
        <RuleTypeIcon type="no_parking" size="md" label="No parking, medium" />
        <RuleTypeIcon type="no_parking" size="lg" label="No parking, large" />
      </div>
    </div>
  );
}
