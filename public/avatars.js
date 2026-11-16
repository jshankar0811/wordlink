const WORDLINK_AVATARS = [
  ...Array.from({ length: 24 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      id: `avatar_${number}`,
      image: `/avatars/avatar_${number}.svg`,
      name: `Avatar ${index + 1}`
    };
  }),
  { id: "fox", emoji: "🦊", name: "Fox" },
  { id: "frog", emoji: "🐸", name: "Frog" },
  { id: "panda", emoji: "🐼", name: "Panda" },
  { id: "cat", emoji: "🐱", name: "Cat" },
  { id: "unicorn", emoji: "🦄", name: "Unicorn" },
  { id: "octopus", emoji: "🐙", name: "Octopus" }
];

if (typeof module !== "undefined") module.exports = WORDLINK_AVATARS;
