import React from "react";

export default function GlassCard(
  props: React.PropsWithChildren<{ title?: string; subtitle?: string; right?: React.ReactNode }>
) {
  const { title, subtitle, right, children } = props;
  return (
    <section className="glass p-5 md:p-8">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          {title && <h2 className="text-xl md:text-2xl font-semibold">{title}</h2>}
          {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
