"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";

type Option = { id: string; name: string; countryId?: string; universityId?: string };

export default function OnboardingPage() {
  const { t } = useI18n();
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  const [countries, setCountries] = useState<Option[]>([]);
  const [universities, setUniversities] = useState<Option[]>([]);
  const [fields, setFields] = useState<Option[]>([]);
  const [country, setCountry] = useState("");
  const [university, setUniversity] = useState("");
  const [field, setField] = useState("");
  const [year, setYear] = useState("");

  useEffect(() => {
    void (async () => {
      const [c, u, b] = await Promise.all([
        getDocs(collection(getDb(), collections.country)),
        getDocs(collection(getDb(), collections.university)),
        getDocs(collection(getDb(), collections.branch)),
      ]);
      setCountries(c.docs.map((d) => ({ id: d.id, name: String(d.get("name") || d.id) })));
      setUniversities(
        u.docs.map((d) => ({
          id: d.id,
          name: String(d.get("name") || d.id),
          countryId: d.get("countryRef")?.id,
        })),
      );
      setFields(
        b.docs.map((d) => ({
          id: d.id,
          name: String(d.get("name") || d.id),
          universityId: d.get("universityRef")?.id,
        })),
      );
    })();
  }, []);

  async function save() {
    if (!user || !country || !university || !field) return;
    await updateDoc(doc(getDb(), collections.users, user.uid), {
      countryRef: doc(getDb(), collections.country, country),
      universityRef: doc(getDb(), collections.university, university),
      branchRef: doc(getDb(), collections.branch, field),
      year_of_study: year || null,
      welcomeStatus: true,
    });
    await refreshProfile();
    router.replace("/");
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-lg place-items-center px-6">
      <div className="w-full space-y-4">
        <h1 className="text-2xl font-semibold">{t("createAccount")}</h1>
        <Select label={t("country")} value={country} onChange={setCountry} options={countries} />
        <Select
          label={t("university")}
          value={university}
          onChange={setUniversity}
          options={universities.filter((u) => !country || u.countryId === country)}
        />
        <Select
          label={t("field")}
          value={field}
          onChange={setField}
          options={fields.filter((f) => !university || f.universityId === university)}
        />
        <label className="block text-sm">
          {t("year")} <span className="text-muted">({t("yearOptional")})</span>
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-line bg-transparent px-3 py-3"
          />
        </label>
        <button type="button" onClick={() => void save()} className="w-full rounded-full bg-primary py-3 font-semibold text-white">
          {t("finish")}
        </button>
      </div>
    </main>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
}) {
  return (
    <label className="block text-sm">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-line bg-bg px-3 py-3"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
