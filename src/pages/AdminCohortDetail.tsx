import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Download, ArrowLeft, Users, FileText } from "lucide-react";
import { motion } from "motion/react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const teamRadarData = [
  { subject: "Producer (P)", is: 38, should: 35, want: 40, fullMark: 50 },
  { subject: "Administrator (A)", is: 32, should: 42, want: 30, fullMark: 50 },
  { subject: "Entrepreneur (E)", is: 28, should: 30, want: 35, fullMark: 50 },
  { subject: "Integrator (I)", is: 42, should: 45, want: 40, fullMark: 50 },
];

const styleDistribution = [
  { name: "Producer", count: 8 },
  { name: "Administrator", count: 5 },
  { name: "Entrepreneur", count: 3 },
  { name: "Integrator", count: 10 },
];

const respondents = [
  { id: "1", name: "Sarah Jenkins", email: "sarah@example.com", status: "Completed", style: "PaEI", date: "2026-03-05" },
  { id: "2", name: "Michael Chen", email: "michael@example.com", status: "Completed", style: "pAeI", date: "2026-03-06" },
  { id: "3", name: "Emma Watson", email: "emma@example.com", status: "Completed", style: "PAei", date: "2026-03-07" },
  { id: "4", name: "David Miller", email: "david@example.com", status: "Pending", style: "-", date: "-" },
];

export function AdminCohortDetail() {
  const { id } = useParams();

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-6">
          <Link to="/admin/cohorts" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-4 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cohorts
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-gray-900">
                Executive Leadership Team
              </h1>
              <p className="text-gray-500 mt-1">Cohort ID: {id} • Created March 1, 2026</p>
            </div>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-400" /> Team Aggregate Profile
              </CardTitle>
              <CardDescription>Average scores across all completed assessments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={teamRadarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 50]} tick={{ fill: '#9ca3af' }} />
                    <Radar name="Is" dataKey="is" stroke="#C8102E" fill="#C8102E" fillOpacity={0.4} />
                    <Radar name="Should" dataKey="should" stroke="#1D3557" fill="#1D3557" fillOpacity={0.4} />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-400" /> Style Distribution
              </CardTitle>
              <CardDescription>Dominant styles across the team</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={styleDistribution} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fill: '#4b5563', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#9ca3af' }} />
                    <Tooltip cursor={{ fill: '#f9fafb' }} />
                    <Bar dataKey="count" fill="#C8102E" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Respondents</CardTitle>
            <CardDescription>Individual assessment status and results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th scope="col" className="px-6 py-3 font-medium">Name</th>
                    <th scope="col" className="px-6 py-3 font-medium">Email</th>
                    <th scope="col" className="px-6 py-3 font-medium">Status</th>
                    <th scope="col" className="px-6 py-3 font-medium">Dominant Style</th>
                    <th scope="col" className="px-6 py-3 font-medium">Completed Date</th>
                    <th scope="col" className="px-6 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {respondents.map((respondent) => (
                    <tr key={respondent.id} className="bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{respondent.name}</td>
                      <td className="px-6 py-4">{respondent.email}</td>
                      <td className="px-6 py-4">
                        {respondent.status === "Completed" ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">Pending</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono font-medium">{respondent.style}</td>
                      <td className="px-6 py-4">{respondent.date}</td>
                      <td className="px-6 py-4 text-right">
                        {respondent.status === "Completed" && (
                          <Link to={`/admin/respondents/${respondent.id}`} className="font-medium text-primary hover:text-primary-dark">
                            View Results
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
