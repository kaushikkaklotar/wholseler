"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money } from "@wholesale/shared";
import { date } from "@/lib/api";
import type { DailySales } from "@/lib/types";
export function SalesChart({
  data,
  height = 235,
}: {
  data: DailySales[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full min-w-0 px-2">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        initialDimension={{ width: 650, height }}
      >
        <AreaChart
          data={data}
          margin={{ top: 10, right: 15, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7169e6" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#7169e6" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="4 4"
            vertical={false}
            stroke="#eff0f5"
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tickMargin={12}
            minTickGap={35}
            tick={{ fill: "#9295a3", fontSize: 10 }}
            tickFormatter={(v) => date(v, { day: "numeric", month: "short" })}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={55}
            tick={{ fill: "#9295a3", fontSize: 10 }}
            tickFormatter={(v) =>
              v >= 100000
                ? `₹${Math.round(v / 100000)}k`
                : `₹${Math.round(v / 100)}`
            }
          />
          <Tooltip
            cursor={{ stroke: "#bbb5ee", strokeDasharray: "3 3" }}
            contentStyle={{
              border: "1px solid #e8e9ef",
              borderRadius: 10,
              fontSize: 11,
              boxShadow: "0 4px 18px #17233d0d",
            }}
            formatter={(value) => [money(Number(value)), "Net sales"]}
            labelFormatter={(value) => date(String(value))}
          />
          <Area
            type="monotone"
            dataKey="salesPaise"
            stroke="#7169e6"
            strokeWidth={2.5}
            fill="url(#salesFill)"
            activeDot={{ r: 5, stroke: "white", strokeWidth: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
