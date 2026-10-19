"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, X } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/types";

const emptyWeek = Array.from({ length: 7 }, (_, i) => ({
  date: `0000-00-0${i + 1}`,
  trained: null,
  strain: null,
}));
const shortDate = (date: string) => date.slice(5).replace("-", ".");

export function TrainingWeek({
  data,
  loading,
  onWorkout,
}: {
  data: DashboardData | null;
  loading: boolean;
  onWorkout: (id: string) => void;
}) {
  const reduced = useReducedMotion();
  const days = data?.week ?? emptyWeek;
  return (
    <div className="dash-week-chart" aria-label="最近七天训练与负荷">
      {days.map((day, index) => {
        const workouts =
          data?.workouts.filter((workout) => workout.date === day.date) ?? [];
        const status =
          day.trained === null
            ? "数据不完整"
            : day.trained
              ? "有训练记录"
              : "无训练记录";
        return (
          <Dialog.Root key={day.date}>
            <Dialog.Trigger asChild>
              <button
                disabled={loading || !data}
                className={`dash-week-day ${day.trained ? "is-trained" : ""} ${index === 6 ? "is-today" : ""}`}
                aria-label={`${day.date}，${status}，每日负荷 ${day.strain ?? "未记录"}，查看详情`}
              >
                <span>
                  {day.strain == null
                    ? "—"
                    : day.strain.toLocaleString("en-US", {
                        maximumFractionDigits: 1,
                      })}
                </span>
                <div className="dash-bar-track">
                  <motion.i
                    initial={false}
                    animate={{
                      height:
                        day.strain == null
                          ? "3px"
                          : `${Math.max(4, Math.min(100, (day.strain / 21) * 100))}%`,
                    }}
                    transition={{
                      duration: reduced ? 0 : 0.45,
                      delay: reduced ? 0 : index * 0.035,
                    }}
                  />
                </div>
                <small>{loading ? "·" : shortDate(day.date)}</small>
                <i className="dash-day-dot" title={status} />
              </button>
            </Dialog.Trigger>
            {/* Keep the dialog inside the dashboard so all eight themes apply. */}
            <Dialog.Overlay className="dash-day-overlay" />
            <Dialog.Content className="dash-day-dialog">
              <Dialog.Close
                className="dash-day-close"
                aria-label="关闭当天训练详情"
              >
                <X size={20} />
              </Dialog.Close>
              <span className="dash-overline">YOUR DAILY RHYTHM</span>
              <Dialog.Title>{day.date}</Dialog.Title>
              <Dialog.Description>
                {status} · {data?.timezone}
                。每日负荷包含全天活动，不等于单次训练负荷之和。
              </Dialog.Description>
              <div className="dash-day-stats">
                <strong>
                  {day.strain ?? "—"}
                  <small> / 21</small>
                </strong>
                <span>每日负荷</span>
              </div>
              {workouts.length ? (
                <ul className="dash-day-workouts">
                  {workouts.map((workout) => (
                    <li key={workout.id}>
                      <Dialog.Close asChild>
                        <button onClick={() => onWorkout(workout.id)}>
                          <span>
                            <strong>{workout.name}</strong>
                            <small>
                              {workout.durationMin} min · 训练负荷{" "}
                              {workout.strain ?? "未记录"}
                            </small>
                          </span>
                          <ArrowUpRight size={18} />
                        </button>
                      </Dialog.Close>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dash-muted">
                  {day.trained === null
                    ? "同步覆盖尚不完整，暂时无法判断当天是否训练。"
                    : "这一天没有训练记录。休息也是节奏的一部分。"}
                </p>
              )}
            </Dialog.Content>
          </Dialog.Root>
        );
      })}
    </div>
  );
}
