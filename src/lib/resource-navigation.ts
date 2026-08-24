export type ResourceRoute =
  | "/towers"
  | "/progress"
  | "/walkthroughs"
  | "/battle-power"
  | "/mob-levels"
  | "/defenses"
  | "/videos";

export type ResourceSection = {
  to: ResourceRoute;
  icon: string;
  title: string;
  subtitle: string;
};

export const RESOURCE_BACK_LINKS = {
  "/progress": { label: "На головну", to: "/" },
  "/walkthroughs": { label: "На головну", to: "/" },
  "/battle-power": { label: "Назад", to: "/progress" },
  "/mob-levels": { label: "Назад", to: "/progress" },
  "/defenses": { label: "Назад", to: "/walkthroughs" },
  "/videos": { label: "Назад", to: "/walkthroughs" },
} as const;

export const LANDING_SECTIONS: ResourceSection[] = [
  {
    to: "/towers",
    icon: "🏰",
    title: "Вежі",
    subtitle: "GvG · 48 позицій веж",
  },
  {
    to: "/progress",
    icon: "💪",
    title: "БС та моби",
    subtitle: "Бойова сила · рівні мобів",
  },
  {
    to: "/walkthroughs",
    icon: "🎯",
    title: "Проходки",
    subtitle: "База захистів · відео проходок",
  },
];

export const PLAYER_PROGRESS_SECTIONS: ResourceSection[] = [
  {
    to: "/battle-power",
    icon: "💪",
    title: "Бойова Сила",
    subtitle: "Збереження бойової сили учасників",
  },
  {
    to: "/mob-levels",
    icon: "👾",
    title: "Рівні мобів",
    subtitle: "Перегляд і редагування мобів учасників",
  },
];

export const WALKTHROUGH_SECTIONS: ResourceSection[] = [
  {
    to: "/defenses",
    icon: "🛡",
    title: "База захистів",
    subtitle: "Скріншоти · коди проходок · пошук по героях",
  },
  {
    to: "/videos",
    icon: "🎥",
    title: "Відео проходок",
    subtitle: "Пошук відео з Telegram по героях",
  },
];
