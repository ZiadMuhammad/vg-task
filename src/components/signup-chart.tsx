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
import { number } from "@/lib/utils";
export function SignupChart({
  data,
}: {
  data: { day: string; signups: number }[];
}) {
  const label = (day: string) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(day));
  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label={`Daily signups in UTC. ${number.format(data.reduce((sum, d) => sum + d.signups, 0))} signups across the last 30 days.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 15, right: 15, bottom: 0, left: -20 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id="signup-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f766e" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#0f766e" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#eef2f5" />
          <XAxis
            dataKey="day"
            tickFormatter={label}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={45}
            dy={10}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            labelFormatter={(value) => label(String(value))}
            formatter={(value) => [number.format(Number(value)), "Signups"]}
            contentStyle={{
              borderRadius: 10,
              borderColor: "#e2e8f0",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="signups"
            stroke="#0f766e"
            strokeWidth={2.5}
            fill="url(#signup-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
