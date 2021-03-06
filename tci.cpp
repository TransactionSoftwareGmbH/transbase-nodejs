#include <napi.h>
#include "tci.h"
#include <variant>

/**
 * node-api tci wrapper
 */
class TCI : public Napi::ObjectWrap<TCI>
{
private:
	TCIState state = TCI_SUCCESS;
	TCIError *error = NULL;
	TCIEnvironment *environment = NULL;
	TCIConnection *connection = NULL;
	TCIStatement *statement = NULL;
	TCIResultSet *resultSet = NULL;
	char sqlcode[5];
	Error errorCode;
	char errorMessage[1000];
	short isNull;
	Napi::Env env;

public:
	TCI(const Napi::CallbackInfo &info) : Napi::ObjectWrap<TCI>(info), env(info.Env())
	{
	}

	~TCI()
	{
		free();
	}

	static void Init(Napi::Env env, Napi::Object exports)
	{
		// define the js class wrapper
		auto tci = DefineClass(env, "TCI", {
											   InstanceMethod<&TCI::connect>("connect"),
											   InstanceMethod<&TCI::executeDirect>("executeDirect"),
											   InstanceMethod<&TCI::prepare>("prepare"),
											   InstanceMethod<&TCI::execute>("execute"),
											   InstanceMethod<&TCI::setParam>("setParam"),
											   InstanceMethod<&TCI::fetch>("fetch"),
											   InstanceMethod<&TCI::getState>("getState"),
											   InstanceMethod<&TCI::getResultSetAttribute>("getResultSetAttribute"),
											   InstanceMethod<&TCI::getResultSetStringAttribute>("getResultSetStringAttribute"),
											   InstanceMethod<&TCI::getValue>("getValue"),
											   InstanceMethod<&TCI::getQueryType>("getQueryType"),
											   InstanceMethod<&TCI::close>("close"),
										   });
		exports.Set("TCI", tci);
	}

	void connect(const Napi::CallbackInfo &info)
	{
		if (info.Length() != 1 || !info[0].IsObject())
			throw Napi::Error::New(env, "connect is missing config argument {url,user,password}");

		Napi::Object config = info[0].As<Napi::Object>();

		if (!(config.HasOwnProperty("url") && config.Get("url").IsString()))
			throw Napi::Error::New(env, "connect requires a string url");
		if (!(config.HasOwnProperty("user") && config.Get("user").IsString()))
			throw Napi::Error::New(env, "connect requires a string user");
		if (!(config.HasOwnProperty("password") && config.Get("password").IsString()))
			throw Napi::Error::New(env, "connect requires a string password");

		std::string url = config.Get("url").As<Napi::String>();
		std::string user = config.Get("user").As<Napi::String>();
		std::string password = config.Get("password").As<Napi::String>();

		if ((state = TCIAllocEnvironment(&environment) || (state = TCIAllocError(environment, &error))))
		{
			TCIGetEnvironmentError(environment, 1, errorMessage, sizeof(errorMessage), NULL, NULL);
			free();
			Napi::Error::New(env, errorMessage);
		}

		tci(TCIAllocConnection(environment, error, &connection));
		tci(TCIConnect(connection, &url[0]));
		tci(TCILogin(connection, &user[0], &password[0]));
		tci(TCIAllocStatement(connection, error, &statement));
		tci(TCIAllocResultSet(statement, error, &resultSet));
	}

	void executeDirect(const Napi::CallbackInfo &info)
	{
		std::string query = info[0].As<Napi::String>().Utf8Value();
		tci(TCIExecuteDirect(resultSet, &query[0], 1, 0));
	}

	void prepare(const Napi::CallbackInfo &info)
	{
		auto query = info[0].As<Napi::String>().Utf8Value();
		tci(TCIPrepareA(statement, &query[0]));
	}

	void execute(const Napi::CallbackInfo &info)
	{
		tci(TCIExecuteA(resultSet, 1, 0));
	}

	void setParam(const Napi::CallbackInfo &info)
	{
		setData(info[0], info[1]);
	}

	void setData(Napi::Value nameOrPosition, Napi::Value value)
	{
		auto typeAndValue = getTciTypeAndValue(value);
		auto type = typeAndValue.first;
		auto data = typeAndValue.second;
		auto size = sizeof(data);

		if (nameOrPosition.IsNumber())
		{
			auto position = nameOrPosition.As<Napi::Number>().Uint32Value() + 1;
			if (type == TCI_C_CHAR) // TODO: string handling get<std::string> require libcpp
				tci(TCISetData(resultSet, position, value.ToString().Utf8Value().data(), size, type, NULL));
			else if (type == TCI_C_BYTE)
			{
				auto buffer = value.As<Napi::Buffer<unsigned char>>();
				tci(TCISetData(resultSet, position, buffer.Data(), buffer.Length(), type, NULL));
			}
			else
				tci(TCISetData(resultSet, position, &data, size, type, NULL));
		}
		else
		{
			auto name = nameOrPosition.As<Napi::String>().Utf8Value();
			if (type == TCI_C_CHAR)
				tci(TCISetDataByName(resultSet, &name[0], value.ToString().Utf8Value().data(), size, type, NULL));
			else if (type == TCI_C_BYTE)
			{
				auto buffer = value.As<Napi::Buffer<unsigned char>>();
				tci(TCISetDataByName(resultSet, &name[0], buffer.Data(), buffer.Length(), type, NULL));
			}
			else
				tci(TCISetDataByName(resultSet, &name[0], &data, size, type, NULL));
		}
	}

	std::pair<Int2, std::variant<bool, int32_t, int64_t, double, std::string>> getTciTypeAndValue(Napi::Value value)
	{
		if (value.IsBoolean())
		{
			return std::pair(TCI_C_INT1, value.As<Napi::Boolean>().Value());
		}
		else if (value.IsNumber())
		{
			auto number = value.As<Napi::Number>();
			if (number.IsBigInt())
			{
				return std::pair(TCI_C_INT8, value.As<Napi::Number>().Int64Value());
			}
			else if (isNapiValueInteger(env, number))
			{
				return std::pair(TCI_C_INT4, value.As<Napi::Number>().Int32Value());
			}
			else
			{
				return std::pair(TCI_C_DOUBLE, value.As<Napi::Number>().DoubleValue());
			}
		}
		else if (value.IsBuffer())
		{
			return std::pair(TCI_C_BYTE, -1);
		}
		else
		{
			return std::pair(TCI_C_CHAR, value.ToString().Utf8Value());
		}
	}

	Napi::Value getQueryType(const Napi::CallbackInfo &info)
	{
		auto queryType = getResultSetAttribute(TCI_ATTR_QUERY_TYPE);
		if (sel_class(queryType))
			return Napi::String::New(env, "SELECT");
		if (upd_class(queryType))
			return Napi::String::New(env, "UPDATE");
		if (ddl_class(queryType))
			return Napi::String::New(env, "SCHEMA");
		return Napi::Number::New(env, queryType);
	}

	Napi::Value getResultSetAttribute(const Napi::CallbackInfo &info)
	{
		auto attrKey = info[0].As<Napi::Number>().Uint32Value();
		auto col = info.Length() > 1 ? info[1].As<Napi::Number>() : 1;
		auto attr = getResultSetAttribute(attrKey, col);
		return Napi::Number::New(env, attr);
	}

	int getResultSetAttribute(int attrKey, int col = 1)
	{
		Uint2 value = 0;
		tci(TCIGetResultSetAttribute(resultSet, attrKey, col, &value, sizeof(value), NULL));
		return value;
	}

	Napi::Value getResultSetStringAttribute(const Napi::CallbackInfo &info)
	{
		char value[MAXIDENTSIZE];
		auto attrKey = info[0].As<Napi::Number>().Uint32Value();
		auto col = info.Length() > 1 ? info[1].As<Napi::Number>() : 1;
		tci(TCIGetResultSetAttribute(resultSet, attrKey, col, &value, sizeof(value), NULL));
		return Napi::String::New(env, value);
	}

	Napi::Value fetch(const Napi::CallbackInfo &info)
	{
		auto scrollMode = info.Length() > 0 ? info[0].As<Napi::Number>().Uint32Value() : TCI_FETCH_NEXT;

		state = TCIFetch(resultSet, 1, scrollMode, 0);
		if (state == TCI_SUCCESS)
			return Napi::Boolean::New(env, true);
		if (state == TCI_NO_DATA_FOUND)
			return Napi::Boolean::New(env, false);
		else
			tci(state);

		return env.Undefined();
	}

	Napi::Value getState(const Napi::CallbackInfo &info)
	{
		return Napi::Number::New(env, state);
	}

	Napi::Value getValue(Columnnumber col, int sqlType)
	{
		switch (sqlType)
		{
		// logical
		case TCI_SQL_BOOL:
			return getBooleanValue(col);
		// numerical
		case TCI_SQL_TINYINT:
		case TCI_SQL_SMALLINT:
		case TCI_SQL_INTEGER:
			return getIntegerValue(col);
		case TCI_SQL_BIGINT:
			return getBigIntValue(col);
		case TCI_SQL_FLOAT:
			return getFloatValue(col);
		case TCI_SQL_DOUBLE:
		case TCI_SQL_NUMERIC:
			return getDoubleValue(col);
		case TCI_SQL_BLOB:
			return getBlobValue(col);
		// character
		case TCI_SQL_CHAR:
		case TCI_SQL_VARCHAR:
		case TCI_SQL_CLOB:
		default:
			return getStringValue(col);
		}
	}

	Napi::Value getValue(const Napi::CallbackInfo &info)
	{
		Columnnumber col = info[0].As<Napi::Number>().Uint32Value();
		auto sqlType = info[1].As<Napi::Number>().Uint32Value();
		isNull = 0;
		auto value = getValue(col, sqlType);
		return isNull ? env.Null() : value;
	}

	Napi::Value getBooleanValue(Columnnumber &colNumber)
	{
		bool b;
		tci(TCIGetData(resultSet, colNumber, &b, sizeof(b), NULL, TCI_C_INT1, &isNull));
		return Napi::Boolean::New(env, b);
	}

	Napi::Value getIntegerValue(Columnnumber &colNumber)
	{
		int i;
		tci(TCIGetData(resultSet, colNumber, &i, sizeof(i), NULL, TCI_C_INT4, &isNull));
		return Napi::Number::New(env, i);
	}

	Napi::Value getBigIntValue(Columnnumber &colNumber)
	{
		long long ll;
		tci(TCIGetData(resultSet, colNumber, &ll, sizeof(ll), NULL, TCI_C_INT8, &isNull));
		return Napi::Number::New(env, ll);
	}

	Napi::Value getFloatValue(Columnnumber &colNumber)
	{
		float f;
		tci(TCIGetData(resultSet, colNumber, &f, sizeof(f), NULL, TCI_C_FLOAT, &isNull));
		return Napi::Number::New(env, f);
	}

	Napi::Value getDoubleValue(Columnnumber &colNumber)
	{
		double d;
		tci(TCIGetData(resultSet, colNumber, &d, sizeof(d), NULL, TCI_C_DOUBLE, &isNull));
		return Napi::Number::New(env, d);
	}

	Napi::Value getBlobValue(Columnnumber &colNumber)
	{
		Int4 blobSize;
		tci(TCIGetDataSize(resultSet, colNumber, TCI_C_BYTE, &blobSize, &isNull));
		auto buffer = Napi::Buffer<unsigned char>::New(env, blobSize);
		tci(TCIGetData(resultSet, colNumber, buffer.Data(), blobSize, NULL, TCI_C_BYTE, &isNull));
		return buffer;
	}

	Napi::Value getStringValue(Columnnumber &colNumber)
	{
		Int4 charLength;
		Int4 byteSize;
		tci(TCIGetDataSize(resultSet, colNumber, TCI_C_CHAR, &byteSize, &isNull));
		tci(TCIGetDataCharLength(resultSet, colNumber, &charLength, &isNull));

		if (isNull)
			return env.Null();
		if (byteSize == 0 || charLength == 0)
			return Napi::String::New(env, "");

		std::string str(charLength, ' ');
		tci(TCIGetData(resultSet, colNumber, str.data(), byteSize + 1, NULL, TCI_C_CHAR, &isNull));
		return Napi::String::New(env, str);
	}

	void close(const Napi::CallbackInfo &info)
	{
		free();
	}

	void free()
	{
		if (resultSet)
			TCIFreeResultSet(resultSet);
		if (statement)
			TCIFreeStatement(statement);
		if (connection)
			TCIFreeConnection(connection);
		if (error)
			TCIFreeError(error);
		if (environment)
			TCIFreeEnvironment(environment);
	}

	void tci(TCIState state)
	{
		this->state = state;
		if (state)
		{
			TCIGetError(error, 1, 1, errorMessage, sizeof(errorMessage), &errorCode, sqlcode);
			printf("TCIError %d: %s\n SQLCode: %s\n", errorCode, errorMessage, sqlcode);
			throw Napi::Error::New(env, errorMessage);
		}
	}

	static bool isNapiValueInteger(Napi::Env &env, Napi::Value &num)
	{
		return env.Global()
			.Get("Number")
			.ToObject()
			.Get("isInteger")
			.As<Napi::Function>()
			.Call({num})
			.ToBoolean()
			.Value();
	}
};

static void DefineConstants(Napi::Env env, Napi::Object exports)
{
	auto attribute = Napi::Object::New(env);
	attribute.Set("TCI_ATTR_COLUMN_COUNT", TCI_ATTR_COLUMN_COUNT);
	attribute.Set("TCI_ATTR_COLUMN_NAME", TCI_ATTR_COLUMN_NAME);
	attribute.Set("TCI_ATTR_COLUMN_TYPE", TCI_ATTR_COLUMN_TYPE);
	attribute.Set("TCI_ATTR_RECORDS_TOUCHED", TCI_ATTR_RECORDS_TOUCHED);
	exports.Set("Attribute", attribute);

	auto state = Napi::Object::New(env);
	state.Set("SUCCESS", TCI_SUCCESS);
	state.Set("ERROR", TCI_ERROR);
	state.Set("NO_DATA_FOUND", TCI_NO_DATA_FOUND);
	exports.Set("State", state);
}

// Initialize native add-on
Napi::Object Init(Napi::Env env, Napi::Object exports)
{
	TCI::Init(env, exports);
	DefineConstants(env, exports);
	return exports;
}

NODE_API_MODULE(transbase, Init);
