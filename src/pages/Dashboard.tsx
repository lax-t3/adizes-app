import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useAssessmentStore } from "@/store/assessmentStore";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FileText, ArrowRight, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";

export function Dashboard() {
  const { user } = useAuthStore();
  const { resultId } = useAssessmentStore();
  const navigate = useNavigate();

  const hasCompleted = !!resultId;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h1 className="text-3xl font-display font-bold text-gray-900">
              Welcome, {user?.name}
            </h1>
            <p className="mt-2 text-gray-600">
              Manage your Adizes Management Style Indicator assessments.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="col-span-1 md:col-span-2 lg:col-span-2 border-l-4 border-l-primary shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">AMSI Assessment</CardTitle>
                    <CardDescription className="mt-1">
                      Discover your natural management style and how it aligns with your role.
                    </CardDescription>
                  </div>
                  {hasCompleted ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                      Pending
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">36 Questions</p>
                      <p className="text-sm text-gray-500">Takes ~15 minutes</p>
                    </div>
                  </div>

                  {hasCompleted ? (
                    <Button onClick={() => navigate(`/results?id=${resultId}`)} className="w-full sm:w-auto">
                      View Results <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={() => navigate("/assessment")} className="w-full sm:w-auto shadow-sm">
                      Start Assessment <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
