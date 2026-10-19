-- Add the landing-page brand palette; preserve every existing theme and share.
ALTER TABLE "training_shares" DROP CONSTRAINT "training_shares_theme_check";
ALTER TABLE "training_shares" ADD CONSTRAINT "training_shares_theme_check"
  CHECK ("theme" IN ('whooper','flexoki','monochrome','latte','tokyo','gruvbox','nord','rose','matrix'));
