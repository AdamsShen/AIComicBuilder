"use client";

interface TransactionRowProps {
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

export function TransactionRow({ type, amount, description, createdAt }: TransactionRowProps) {
  const isRecharge = type === "recharge";
  const absAmount = Math.abs(amount) / 100;

  return (
    <div className="flex items-center justify-between rounded-xl px-4 py-3 hover:bg-[--surface] transition-colors">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-[--text-primary]">
          {isRecharge ? `+¥${absAmount.toFixed(2)}` : `-¥${absAmount.toFixed(2)}`}
        </span>
        <span className="text-xs text-[--text-muted]">{description}</span>
      </div>
      <span className="text-xs text-[--text-muted]">
        {new Date(createdAt).toLocaleDateString("zh-CN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}
