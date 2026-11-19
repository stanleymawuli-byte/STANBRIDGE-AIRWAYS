"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  ShieldCheck,
  X,
} from "lucide-react";

type Flight = {
  id: string;
  origin: string;
  destination: string;
  depart: string;
  arrive: string;
  duration: string;
  price: number;
  currency: string;
  airline: string;
  stops: number;
  offer: Record<string, unknown> & {
    id: string;
    type: string;
    price: { total: string; currency: string };
    itineraries: unknown[];
  };
};

function emptyPassenger() {
  return {
    title: "Mr",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    email: "",
    phone: "",
  };
}

export function FlightSearch() {
  const [trip, setTrip] = useState("round");
  const [from, setFrom] = useState("ACC");
  const [to, setTo] = useState("LHR");
  const [depart, setDepart] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [passengers, setPassengers] = useState("1");
  const [cabin, setCabin] = useState("Economy");
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [passengerDetails, setPassengerDetails] = useState([emptyPassenger()]);
  const [bookingLoading, setBookingLoading] = useState(false);

  function updatePassenger(index: number, field: keyof ReturnType<typeof emptyPassenger>, value: string) {
    setPassengerDetails((current) =>
      current.map((passenger, passengerIndex) =>
        passengerIndex === index ? { ...passenger, [field]: value } : passenger,
      ),
    );
  }

  async function createBooking() {
    if (!selectedFlight) return;
    if (passengerDetails.some((passenger) =>
      !passenger.firstName.trim() ||
      !passenger.lastName.trim() ||
      !passenger.dateOfBirth ||
      !passenger.gender ||
      !passenger.email.trim() ||
      !passenger.phone.trim()
    )) {
      setNotice("Complete each passenger's details, including gender, email, and international phone number.");
      return;
    }

    setBookingLoading(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: selectedFlight.id,
          offer: selectedFlight.offer,
          expectedPrice: selectedFlight.price,
          expectedCurrency: selectedFlight.currency,
          origin: from,
          destination: to,
          departureDate: depart,
          returnDate: trip === "round" ? returnDate : undefined,
          cabin,
          passengers: passengerDetails,
        }),
      });
      const data = await response.json() as { error?: string; booking?: { reference: string } };
      if (!response.ok) throw new Error(data.error ?? "Could not create booking.");
      window.location.assign("/account");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create booking.");
    } finally {
      setBookingLoading(false);
    }
  }

  async function searchFlights(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (from === to) {
      setNotice("Your origin and destination must be different.");
      return;
    }
    if (trip === "round" && returnDate < depart) {
      setNotice("Your return date must be on or after your departure date.");
      return;
    }

    setNotice("");
    setSearched(true);
    setLoading(true);
    setResults([]);
    try {
      const query = new URLSearchParams({
        origin: from,
        destination: to,
        departureDate: depart,
        adults: passengers,
        travelClass: cabin,
      });
      if (trip === "round") query.set("returnDate", returnDate);
      const response = await fetch(`/api/flights?${query.toString()}`);
      const data = await response.json() as { flights?: Flight[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Flight search failed.");
      setResults(data.flights ?? []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Flight search failed.");
    } finally {
      setLoading(false);
    }
    document.getElementById("flight-results")?.scrollIntoView({ behavior: "smooth" });
  }

  function swapRoute() {
    setFrom(to);
    setTo(from);
  }

  return (
    <section className="booking-section" id="book">
      <div className="booking-heading">
        <div>
          <div className="eyebrow dark"><span /> YOUR JOURNEY STARTS HERE</div>
          <h2>Where would you like to go?</h2>
        </div>
        <div className="booking-side-note">A world of destinations,<br />one seamless journey.</div>
      </div>
      <div className="booking-card">
        <div className="booking-tabs">
          <div className="trip-tabs">
            <button type="button" className={trip === "round" ? "active" : ""} onClick={() => setTrip("round")}>Round trip</button>
            <button type="button" className={trip === "one" ? "active" : ""} onClick={() => setTrip("one")}>One way</button>
          </div>
          <span className="secure-note"><ShieldCheck size={15} /> Secure booking</span>
        </div>
        <form onSubmit={searchFlights}>
          <div className="route-fields">
            <label className="field">
              <span>FROM</span>
              <select value={from} onChange={(event) => setFrom(event.target.value)}>
                <option value="ACC">Accra · ACC</option><option value="LOS">Lagos · LOS</option>
                <option value="LHR">London · LHR</option><option value="DXB">Dubai · DXB</option>
              </select>
              <small>Departure airport</small>
            </label>
            <button type="button" className="swap" onClick={swapRoute} aria-label="Swap origin and destination">
              <ArrowLeftRight size={18} />
            </button>
            <label className="field">
              <span>TO</span>
              <select value={to} onChange={(event) => setTo(event.target.value)}>
                <option value="LHR">London · LHR</option><option value="DXB">Dubai · DXB</option>
                <option value="LOS">Lagos · LOS</option><option value="ACC">Accra · ACC</option>
              </select>
              <small>Arrival airport</small>
            </label>
          </div>
          <div className="date-fields">
            <label className="field">
              <span>DEPARTURE</span>
              <div className="date-input">
                <CalendarDays size={17} />
                <input type="date" value={depart} min={new Date().toISOString().split("T")[0]}
                  onChange={(event) => setDepart(event.target.value)} required />
              </div>
              <small>Select your travel date</small>
            </label>
            {trip === "round" && <label className="field">
              <span>RETURN</span>
              <div className="date-input">
                <CalendarDays size={17} />
                <input type="date" value={returnDate} min={depart || new Date().toISOString().split("T")[0]}
                  onChange={(event) => setReturnDate(event.target.value)} required />
              </div>
              <small>When are you coming back?</small>
            </label>}
            <label className="field">
              <span>PASSENGERS</span>
              <select value={passengers} onChange={(event) => setPassengers(event.target.value)}>
                {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} passenger{count > 1 ? "s" : ""}</option>)}
              </select>
              <small>Adults and children</small>
            </label>
            <label className="field cabin-field">
              <span>TRAVEL CLASS</span>
              <select value={cabin} onChange={(event) => setCabin(event.target.value)}>
                <option>Economy</option><option>Premium Economy</option><option>Business</option><option>First Class</option>
              </select>
              <small>Your preferred comfort</small>
            </label>
          </div>
          <div className="form-bottom">
            <span><ShieldCheck size={15} /> Your journey, your way.</span>
            <button className="search-btn" type="submit">Search flights <ArrowRight size={17} /></button>
          </div>
        </form>
      </div>
      {notice && <p className="notice" role="alert">{notice}</p>}
      {searched && <div id="flight-results" className="results">
        <div className="results-title">
          <div><span className="eyebrow dark">LIVE FLIGHT OPTIONS</span><h3>{from} <ArrowRight size={19} /> {to}</h3></div>
          <span className="demo-label">AMADEUS TEST INVENTORY</span>
        </div>
        {loading ? <p className="empty-results">Searching live flight availability...</p> : results.length ? results.map((flight) => (
          <div className="flight-row" key={flight.id}>
            <div><b>{flight.depart}</b><small>{flight.origin}</small></div>
            <div className="duration">
              <span>{flight.duration || "Duration unavailable"}</span><i />
              <small>{flight.stops === 0 ? "Direct flight" : `${flight.stops} stop${flight.stops === 1 ? "" : "s"}`}</small>
            </div>
            <div><b>{flight.arrive}</b><small>{flight.destination}</small></div>
            <div className="flight-price">
              <b>{flight.currency} {flight.price.toLocaleString()}</b><small>{flight.airline || "Airline"} · total offer price</small>
            </div>
            <button type="button" onClick={() => {
              setSelectedFlight(flight);
              setPassengerDetails(Array.from({ length: Number(passengers) }, emptyPassenger));
            }}>Select <ArrowRight size={15} /></button>
          </div>
        )) : <p className="empty-results">No flight offers returned for this route and date. Try another date or route.</p>}
      </div>}
      {selectedFlight && <div className="booking-modal-backdrop" role="presentation">
        <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="passenger-heading">
          <button className="booking-modal-close" type="button" onClick={() => setSelectedFlight(null)} aria-label="Close passenger form"><X size={18} /></button>
          <div className="eyebrow dark"><span /> PASSENGER DETAILS</div>
          <h2 id="passenger-heading">Complete your booking</h2>
          <p>{from} to {to} · {selectedFlight.currency} {selectedFlight.price.toLocaleString()} total fare</p>
          {passengerDetails.map((passenger, index) => (
            <fieldset className="passenger-details" key={index}>
              <legend>Passenger {index + 1}</legend>
              <div className="passenger-form">
                <label><span>Title</span><select value={passenger.title} onChange={(event) => updatePassenger(index, "title", event.target.value)}><option>Mr</option><option>Mrs</option><option>Ms</option><option>Miss</option><option>Dr</option></select></label>
                <label><span>First name</span><input autoComplete="given-name" value={passenger.firstName} onChange={(event) => updatePassenger(index, "firstName", event.target.value)} required /></label>
                <label><span>Last name</span><input autoComplete="family-name" value={passenger.lastName} onChange={(event) => updatePassenger(index, "lastName", event.target.value)} required /></label>
                <label><span>Date of birth</span><input type="date" value={passenger.dateOfBirth} onChange={(event) => updatePassenger(index, "dateOfBirth", event.target.value)} required /></label>
                <label><span>Gender</span><select value={passenger.gender} onChange={(event) => updatePassenger(index, "gender", event.target.value)} required><option value="">Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option></select></label>
                <label><span>Email</span><input autoComplete="email" type="email" value={passenger.email} onChange={(event) => updatePassenger(index, "email", event.target.value)} required /></label>
                <label><span>Phone (+country code)</span><input autoComplete="tel" type="tel" placeholder="+233..." value={passenger.phone} onChange={(event) => updatePassenger(index, "phone", event.target.value)} required /></label>
              </div>
            </fieldset>
          ))}
          <button className="search-btn" type="button" onClick={() => void createBooking()} disabled={bookingLoading}>
            {bookingLoading ? "Confirming fare..." : "Continue to payment"} <ArrowRight size={16} />
          </button>
        </section>
      </div>}
    </section>
  );
}
