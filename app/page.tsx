"use client";

import { useState } from "react";
import { ArrowRight, Globe2, Menu, Plane, Sparkles, Luggage, Clock3, X } from "lucide-react";

const destinations = [
  { city: "London", country: "United Kingdom", code: "LHR", image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1000&q=85", note: "A timeless city break" },
  { city: "Dubai", country: "United Arab Emirates", code: "DXB", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1000&q=85", note: "Where ambition meets wonder" },
  { city: "Accra", country: "Ghana", code: "ACC", image: "https://images.unsplash.com/photo-1576485290814-1c72aa4bbb8e?auto=format&fit=crop&w=1000&q=85", note: "The rhythm of West Africa" },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  function showNotice(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 4500); }

  return (
    <main>
      <div className="topline"><span>✦ Connecting Continents. Elevating Journeys.</span><span className="top-right"><Globe2 size={13}/> EN <span className="top-divider">|</span> USD</span></div>
      <header className="nav-wrap">
        <a className="brand" href="#" aria-label="StanBridge Airways home">
          <span className="brand-mark"><Plane size={22}/></span>
          <span><strong>STANBRIDGE</strong><small>A I R W A Y S</small></span>
        </a>
        <nav className={menuOpen ? "nav-links open" : "nav-links"}>
          <a href="/account" onClick={() => setMenuOpen(false)}>Book a flight</a>
          <a href="#destinations" onClick={() => setMenuOpen(false)}>Destinations</a>
          <a href="#experience" onClick={() => setMenuOpen(false)}>Our experience</a>
          <a href="#help" onClick={() => setMenuOpen(false)}>Help</a>
        </nav>
        <div className="nav-actions"><a className="signin" href="/login">Sign in</a><button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X/> : <Menu/>}</button></div>
      </header>

      <section className="hero">
        <div className="hero-image"/>
        <div className="hero-shade"/>
        <div className="hero-content">
          <div className="eyebrow"><span/> CONNECTING CONTINENTS</div>
          <h1>Arrive inspired.<br/><em>Travel beyond.</em></h1>
          <p>Thoughtful journeys. Exceptional comfort.<br className="desktop-break"/> Connecting continents. Elevating journeys.</p>
          <a className="hero-link" href="/account">Plan your journey <ArrowRight size={16}/></a>
        </div>
        <div className="hero-caption"><span>01 / 03</span><span>THE ART OF GOING FURTHER</span></div>
      </section>

      <section className="destinations-section" id="destinations">
        <div className="section-top"><div><div className="eyebrow dark"><span/> FIND YOUR NEXT SOMEWHERE</div><h2>Places that move you.</h2></div><a href="/account" className="text-link">Explore destinations <ArrowRight size={16}/></a></div>
        <div className="destination-grid">{destinations.map((destination)=><article className="destination-card" key={destination.code}><img src={destination.image} alt={`${destination.city}, ${destination.country}`}/><div className="destination-overlay"/><div className="destination-info"><span>FEATURED DESTINATION · {destination.code}</span><h3>{destination.city}</h3><p>{destination.note}</p><a href="/account">Discover journey <ArrowRight size={14}/></a></div></article>)}</div>
      </section>

      <section className="experience" id="experience">
        <div className="experience-image"/>
        <div className="experience-copy"><div className="eyebrow"><span/> THE STANBRIDGE DIFFERENCE</div><h2>Every detail,<br/><em>thoughtfully considered.</em></h2><p>From the moment you plan to the moment you arrive, we believe the journey should feel just as rewarding as the destination.</p><div className="perks"><div><Sparkles/><span><b>Elevated comfort</b><small>Space to settle in and make the journey yours.</small></span></div><div><Luggage/><span><b>Care at every step</b><small>Helpful service from check-in to arrival.</small></span></div><div><Clock3/><span><b>Time well travelled</b><small>A smoother experience, thoughtfully designed.</small></span></div></div></div>
      </section>

      <section className="newsletter" id="help"><div><div className="eyebrow"><span/> STAY IN THE KNOW</div><h2>Let the world come to you.</h2><p>Be first to hear about new routes, travel inspiration and special offers.</p></div><form onSubmit={e => {e.preventDefault(); showNotice("Thanks for your interest. Newsletter sign-up will be connected in a later build step.");}}><input type="email" placeholder="Your email address" required/><button type="submit" aria-label="Subscribe"><ArrowRight/></button></form></section>

      <footer><div className="footer-brand"><span className="brand-mark"><Plane size={20}/></span><span><strong>STANBRIDGE</strong><small>A I R W A Y S</small></span></div><p>Beyond borders. Above expectations.</p><div className="footer-bottom"><span>© 2026 StanBridge Airways.</span><span>Privacy · Terms · Accessibility</span></div></footer>
      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}
    </main>
  );
}
