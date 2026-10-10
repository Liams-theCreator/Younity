import { Link } from 'react-router'

export default function RegisterPage() {

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#101417] px-4 py-10 text-white">
      <section className="w-full max-w-xl rounded-2xl border border-slate-700 bg-[#181c20] p-6 sm:p-10">
        <p className="mb-3 font-semibold text-[#A6DDF5]">
          Younity
        </p>

        <h1 className="text-3xl font-bold">
          Create your account
        </h1>

        <p className="mt-3 text-slate-400">
          Choose how you want to use Younity.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link
            to="/register/student"
            className="rounded-xl bg-[#2854D9] px-5 py-4 text-center font-semibold transition-colors hover:bg-[#2046b8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A6DDF5]"
            >
            I am a student
            </Link>

            <Link
            to="/register/organizer"
            className="rounded-xl border border-slate-600 px-5 py-4 text-center font-semibold transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A6DDF5]"
            >
            I am an organizer
            </Link>

        </div>
      </section>
    </main>
  )
}
