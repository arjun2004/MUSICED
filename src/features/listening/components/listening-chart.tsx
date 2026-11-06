"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { useState } from "react";

type Point = { month: string; count: number };

/**
 * Albums logged per month over the last 12 months. Single series → no legend;
 * the section title names it. Hover shows the exact value; a visually hidden
 * table carries the same data for screen readers.
 */
export function ListeningChart({ data }: { data: Point[] }) {
  const [active, setActive] = useState<number | null>(null);
  const rows = data.map((d) => ({ ...d, label: format(parseISO(`${d.month}-01`), "MMM") }));
  const total = data.reduce((n, d) => n + d.count, 0);

  return (
    <figure>
      <div className="h-36" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
            barCategoryGap={2}
            onMouseLeave={() => setActive(null)}
          >
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-geist-mono)" }}
              tickFormatter={(value: string, index: number) => (index % 2 === 0 ? value : "")}
            />
            <Tooltip
              cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
              content={({ active: on, payload }) =>
                on && payload?.[0] ? (
                  <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg">
                    <p className="text-muted-foreground">{format(parseISO(`${payload[0].payload.month}-01`), "MMMM yyyy")}</p>
                    <p className="font-mono font-medium text-foreground tabular-nums">
                      {payload[0].payload.count} {payload[0].payload.count === 1 ? "album" : "albums"}
                    </p>
                  </div>
                ) : null
              }
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              minPointSize={2}
              isAnimationActive={false}
              onMouseEnter={(_, index) => setActive(index)}
            >
              {rows.map((row, index) => (
                <Cell
                  key={row.month}
                  fill={row.count === 0 ? "var(--star-empty)" : index === active ? "var(--signal)" : "var(--chart-bar)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 font-mono text-xs text-muted-foreground">{total} in the last 12 months</figcaption>
      <table className="sr-only">
        <caption>Albums logged per month</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th scope="row">{format(parseISO(`${d.month}-01`), "MMMM yyyy")}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
