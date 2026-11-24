import { Icon } from "@/components/ui/icon";

export function HomeArt() {
  return (
    <div className="home-art" aria-hidden="true">
      <span className="home-art__sun">
        <span className="home-art__sun-smile" />
      </span>
      <div className="home-art__postcard">
        <span className="home-art__stamp">
          <Icon name="heart" className="h-4 w-4" />
        </span>
        <span className="home-art__cup">
          <Icon name="cup" className="h-8 w-8" />
        </span>
        <p className="home-art__note">
          have a<br />
          good day
        </p>
        <span className="home-art__rule" />
      </div>
      <span className="home-art__leaf">
        <Icon name="plant" className="h-11 w-11" />
      </span>
      <span className="home-art__spark">
        <Icon name="sparkle" className="h-6 w-6" />
      </span>
    </div>
  );
}
