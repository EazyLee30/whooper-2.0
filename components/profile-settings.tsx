"use client";
import { useState } from "react";
import type { ShareProfile } from "@/lib/profile/schema";
export function ProfileSettings({ initial }: { initial: ShareProfile }) {
  const [profile, setProfile] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!response.ok) throw Error();
      setMessage("已保存，之后生成的分享卡会使用这些设置。");
    } catch {
      setMessage("保存失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>个人空间 · 分享身份</h2>
      <p>
        填写你希望展示在训练单上的信息。留空或选择不显示，卡片对应位置就会留空；不会修改
        WHOOP 资料。
      </p>
      <label>
        显示名字
        <input
          maxLength={32}
          value={profile.displayName}
          onChange={(e) =>
            setProfile({ ...profile, displayName: e.target.value })
          }
          placeholder="不填写则留空"
        />
      </label>
      <label>
        性别
        <select
          value={profile.gender}
          onChange={(e) =>
            setProfile({
              ...profile,
              gender: e.target.value as ShareProfile["gender"],
            })
          }
        >
          <option value="hidden">不显示</option>
          <option value="male">男 · M</option>
          <option value="female">女 · F</option>
          <option value="other">其他 · X</option>
        </select>
      </label>
      <button disabled={busy} onClick={save}>
        {busy ? "保存中…" : "保存分享设置"}
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
